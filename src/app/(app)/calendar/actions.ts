"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { copyWeekSchema, planEntrySchema, type CopyWeekInput } from "@/lib/schemas";
import { addDaysKey, keyToDbDate } from "@/lib/dates";
import { gramsPerServing, pickMacros } from "@/lib/macros";
import { copyEntries, nextPosition } from "@/lib/entries";
import { differenceInCalendarDays, parseISO } from "date-fns";

type ActionResult = { ok: true } | { ok: false; error: string };

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
}): Promise<ActionResult> {
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

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      mealId,
      servings,
      grams,
      position: await nextPosition(userId, date, slot),
      ...pickMacros(meal),
    },
  });

  revalidatePath(`/calendar/${date}`);
  revalidatePath("/calendar");
  revalidatePath("/track");
  revalidatePath("/");
  return { ok: true };
}

export async function removePlanEntryAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const entry = await prisma.planEntry.findFirst({
    where: { id, userId },
    select: { date: true },
  });
  if (!entry) return { ok: false, error: "Entry not found." };

  await prisma.planEntry.delete({ where: { id } });
  revalidatePath(`/calendar/${entry.date.toISOString().slice(0, 10)}`);
  revalidatePath("/calendar");
  revalidatePath("/track");
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
  revalidatePath("/calendar");
  revalidatePath("/track");
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
  revalidatePath("/calendar");
  revalidatePath("/track");
  return { ok: true };
}

/**
 * Repeat a week: copy the 7 days starting `fromStart` onto the 7 days starting
 * `toStart`, keeping each entry's weekday offset and slot. Skipped entries are
 * left behind; copies arrive as planned, after anything already on those days.
 */
export async function copyWeekAction(
  input: CopyWeekInput,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = copyWeekSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { fromStart, toStart } = parsed.data;
  if (fromStart === toStart) {
    return { ok: false, error: "Pick two different weeks." };
  }

  const count = await copyEntries(
    userId,
    { dateFrom: fromStart, dateTo: addDaysKey(fromStart, 6) },
    (sourceDate) =>
      addDaysKey(
        toStart,
        differenceInCalendarDays(parseISO(sourceDate), parseISO(fromStart)),
      ),
  );
  if (count === 0) {
    return { ok: false, error: "Nothing planned or logged that week." };
  }

  revalidatePath("/calendar", "layout");
  revalidatePath("/track");
  revalidatePath("/shopping");
  revalidatePath("/");
  return { ok: true, count };
}
