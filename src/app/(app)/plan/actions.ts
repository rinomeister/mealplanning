"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { SLOTS, copyWeekSchema, planEntrySchema, type CopyWeekInput, type SlotKey } from "@/lib/schemas";
import { addDaysKey, keyToDbDate } from "@/lib/dates";
import { gramsPerServing, pickMacros } from "@/lib/macros";
import { copyEntries, nextPosition } from "@/lib/entries";
import { differenceInCalendarDays, parseISO } from "date-fns";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/** Logged from Today (today or earlier) means eaten; from Plan, planned. */
export type LogOptions = { eaten?: boolean };

function revalidateAll() {
  revalidatePath("/plan", "layout");
  revalidatePath("/today");
  revalidatePath("/");
}

/**
 * Add a meal to a day+slot. For a meal whose batch was weighed, `grams` (when
 * given) sets the amount and servings follow from it; otherwise the entry gets
 * the weight its servings come to, so it shows and edits in grams.
 */
export async function addPlanEntryAction(input: {
  date: string;
  slot: string;
  mealId: string;
  servings: number | string;
  grams?: number | string | null;
}, opts: LogOptions = {}): Promise<CreateResult> {
  const userId = await requireUserId();
  const parsed = planEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };
  const { date, slot, mealId } = parsed.data;

  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: {
      id: true,
      kcal: true,
      protein: true,
      fat: true,
      carbs: true,
      sugar: true,
      fiber: true,
      cookedGrams: true,
      serves: true,
    },
  });
  if (!meal) return { ok: false, error: "Meal not found." };

  let servings = parsed.data.servings;
  let grams: number | null = null;
  const gps = gramsPerServing(meal);
  if (gps != null) {
    grams = parsed.data.grams ?? servings * gps;
    servings = grams / gps;
  }

  const created = await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      mealId,
      servings,
      grams,
      status: opts.eaten ? "EATEN" : "PLANNED",
      position: await nextPosition(userId, date, slot),
      ...pickMacros(meal),
    },
    select: { id: true },
  });

  revalidateAll();
  return { ok: true, id: created.id };
}

export async function removePlanEntryAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const entry = await prisma.planEntry.findFirst({
    where: { id, userId },
    select: { date: true },
  });
  if (!entry) return { ok: false, error: "Entry not found." };

  await prisma.planEntry.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

export async function setServingsAction(
  id: string,
  servings: number,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!Number.isFinite(servings) || servings <= 0) {
    return { ok: false, error: "Servings must be positive." };
  }
  const entry = await prisma.planEntry.findFirst({
    where: { id, userId },
    select: { servings: true, grams: true, mealId: true },
  });
  if (!entry) return { ok: false, error: "Entry not found." };
  // A meal eaten by weight keeps grams and servings in step.
  const grams =
    entry.mealId && entry.grams != null && entry.servings > 0
      ? (entry.grams / entry.servings) * servings
      : entry.grams;
  await prisma.planEntry.update({ where: { id }, data: { servings, grams } });
  revalidateAll();
  return { ok: true };
}

export async function setEntryStatusAction(
  id: string,
  status: "PLANNED" | "EATEN" | "SKIPPED",
): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await prisma.planEntry.updateMany({
    where: { id, userId },
    data: { status },
  });
  if (count === 0) return { ok: false, error: "Entry not found." };
  revalidateAll();
  return { ok: true };
}

/**
 * Repeat a week: copy the 7 days starting `fromStart` onto the 7 days starting
 * `toStart`, keeping each entry's weekday offset and slot. Skipped entries are
 * left behind; copies arrive as planned, after anything already on those days.
 */
export async function copyWeekAction(
  input: CopyWeekInput & { replace?: boolean },
): Promise<{ ok: true; count: number; ids: string[] } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = copyWeekSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { fromStart, toStart } = parsed.data;
  if (fromStart === toStart) {
    return { ok: false, error: "Pick two different weeks." };
  }

  if (input.replace) {
    await prisma.planEntry.deleteMany({
      where: {
        userId,
        status: { not: "EATEN" },
        date: { gte: keyToDbDate(toStart), lte: keyToDbDate(addDaysKey(toStart, 6)) },
      },
    });
  }
  const ids = await copyEntries(
    userId,
    { dateFrom: fromStart, dateTo: addDaysKey(fromStart, 6) },
    (sourceDate) =>
      addDaysKey(
        toStart,
        differenceInCalendarDays(parseISO(sourceDate), parseISO(fromStart)),
      ),
  );
  const count = ids.length;
  if (count === 0) {
    return { ok: false, error: "Nothing planned or logged that week." };
  }

  revalidatePath("/plan", "layout");
  revalidatePath("/today");
  revalidatePath("/plan/list");
  revalidatePath("/");
  return { ok: true, count, ids };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Copy a day's slots onto other days. "Replace" first clears what's planned
 * (not what's eaten) in those slots on the target days. Copies arrive as
 * planned; the ids come back so "Add" can be undone.
 */
export async function copyDayToDatesAction(input: {
  fromDate: string;
  toDates: string[];
  slots: string[];
  replace: boolean;
}): Promise<{ ok: true; count: number; ids: string[] } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const toDates = [...new Set(input.toDates)].filter((d) => DATE_RE.test(d) && d !== input.fromDate).slice(0, 62);
  const slots = input.slots.filter((x): x is SlotKey => (SLOTS as readonly string[]).includes(x));
  if (!DATE_RE.test(input.fromDate) || toDates.length === 0 || slots.length === 0) {
    return { ok: false, error: "Pick at least one day and one slot." };
  }
  if (input.replace) {
    await prisma.planEntry.deleteMany({
      where: { userId, status: { not: "EATEN" }, slot: { in: slots }, date: { in: toDates.map(keyToDbDate) } },
    });
  }
  const ids: string[] = [];
  for (const to of toDates) {
    ids.push(...(await copyEntries(userId, { dateFrom: input.fromDate, dateTo: input.fromDate, slots }, () => to)));
  }
  if (ids.length === 0) return { ok: false, error: "Nothing in those slots to copy." };
  revalidatePath("/plan", "layout");
  revalidatePath("/today");
  revalidatePath("/");
  return { ok: true, count: ids.length, ids };
}
