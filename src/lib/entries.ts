import { prisma } from "@/lib/prisma";
import { pickMacros, type MealMacros } from "@/lib/macros";
import { dbDateToKey, keyToDbDate, todayKey, type DateKey } from "@/lib/dates";
import type { SlotKey } from "@/lib/schemas";

/** Next free position in a day+slot, so new entries append rather than collide. */
export async function nextPosition(userId: string, date: DateKey, slot: SlotKey) {
  const last = await prisma.planEntry.findFirst({
    where: { userId, date: keyToDbDate(date), slot },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

/**
 * Push a meal's or product's corrected macros into the entries that haven't
 * happened yet (today onwards). Past days keep the numbers they were logged
 * with — that's the whole point of entries carrying their own copy.
 */
export async function refreshUpcomingEntries(
  ref: { mealId: string } | { productId: string },
  macros: MealMacros,
) {
  await prisma.planEntry.updateMany({
    where: { ...ref, date: { gte: keyToDbDate(todayKey()) } },
    data: pickMacros(macros),
  });
}

const MACRO_SELECT = {
  kcal: true,
  protein: true,
  fat: true,
  carbs: true,
  sugar: true,
  fiber: true,
} as const;

/**
 * Copy existing entries to new day(s). `place` maps each source entry to its
 * target date (and keeps the slot). Copies come in as PLANNED, appended after
 * whatever each target day+slot already holds. Meals and products take their
 * *current* macros — a copy is a fresh entry — while quick adds carry theirs
 * over, having nothing else to read from.
 */
export async function copyEntries(
  userId: string,
  where: { dateFrom: DateKey; dateTo: DateKey; slot?: SlotKey },
  place: (sourceDate: DateKey) => DateKey,
): Promise<number> {
  const sources = await prisma.planEntry.findMany({
    where: {
      userId,
      date: { gte: keyToDbDate(where.dateFrom), lte: keyToDbDate(where.dateTo) },
      ...(where.slot ? { slot: where.slot } : {}),
      status: { not: "SKIPPED" },
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }, { position: "asc" }],
    include: {
      meal: { select: MACRO_SELECT },
      product: { select: MACRO_SELECT },
    },
  });
  if (sources.length === 0) return 0;

  const targetDates = [...new Set(sources.map((s) => place(dbDateToKey(s.date))))];
  const existing = await prisma.planEntry.groupBy({
    by: ["date", "slot"],
    where: { userId, date: { in: targetDates.map(keyToDbDate) } },
    _max: { position: true },
  });
  const nextPos = new Map<string, number>();
  for (const row of existing) {
    nextPos.set(`${dbDateToKey(row.date)}|${row.slot}`, (row._max.position ?? -1) + 1);
  }

  await prisma.planEntry.createMany({
    data: sources.map((s) => {
      const date = place(dbDateToKey(s.date));
      const key = `${date}|${s.slot}`;
      const position = nextPos.get(key) ?? 0;
      nextPos.set(key, position + 1);
      return {
        userId,
        date: keyToDbDate(date),
        slot: s.slot,
        mealId: s.mealId,
        productId: s.productId,
        servings: s.servings,
        grams: s.grams,
        label: s.label,
        position,
        ...pickMacros(s.meal ?? s.product ?? s),
      };
    }),
  });
  return sources.length;
}
