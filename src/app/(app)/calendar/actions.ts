"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { copyWeekSchema, planEntrySchema, type CopyWeekInput } from "@/lib/schemas";
import { addDaysKey, keyToDbDate } from "@/lib/dates";
import { pickMacros } from "@/lib/macros";
import { copyEntries, nextPosition } from "@/lib/entries";
import { differenceInCalendarDays, parseISO } from "date-fns";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function addPlanEntryAction(input: {
  date: string;
  slot: string;
  mealId: string;
  servings: number | string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = planEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };
  const { date, slot, mealId, servings } = parsed.data;

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
    },
  });
  if (!meal) return { ok: false, error: "Meal not found." };

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      mealId,
      servings,
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
  const { count } = await prisma.planEntry.updateMany({
    where: { id, userId },
    data: { servings },
  });
  if (count === 0) return { ok: false, error: "Entry not found." };
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
