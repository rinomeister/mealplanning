import { prisma } from "@/lib/prisma";
import { gramsPerServing, pickMacros, type MealMacros } from "@/lib/macros";
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

/**
 * After a meal's batch weight or serving count changes, re-express today's and
 * future entries against the new batch: an entry logged as "350 g" stays 350 g
 * (its servings are recomputed), and one logged by servings gains a weight.
 * Without a batch weight, upcoming entries drop their grams and keep servings.
 */
export async function rescaleUpcomingBatchEntries(
  mealId: string,
  meal: { cookedGrams: number | null; serves: number },
) {
  const today = keyToDbDate(todayKey());
  const gps = gramsPerServing(meal);
  if (gps == null) {
    await prisma.planEntry.updateMany({
      where: { mealId, date: { gte: today }, grams: { not: null } },
      data: { grams: null },
    });
    return;
  }
  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "PlanEntry" SET "servings" = "grams" / ${gps}
      WHERE "mealId" = ${mealId} AND "grams" IS NOT NULL AND "date" >= ${today}`,
    prisma.$executeRaw`
      UPDATE "PlanEntry" SET "grams" = "servings" * ${gps}
      WHERE "mealId" = ${mealId} AND "grams" IS NULL AND "date" >= ${today}`,
  ]);
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
      meal: { select: { ...MACRO_SELECT, cookedGrams: true, serves: true } },
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
      // A meal eaten by weight keeps its weight against today's batch.
      let { servings, grams } = s;
      if (s.meal) {
        const gps = gramsPerServing(s.meal);
        if (gps == null) grams = null;
        else if (grams != null) servings = grams / gps;
        else grams = servings * gps;
      }
      return {
        userId,
        date: keyToDbDate(date),
        slot: s.slot,
        mealId: s.mealId,
        productId: s.productId,
        servings,
        grams,
        label: s.label,
        position,
        ...pickMacros(s.meal ?? s.product ?? s),
      };
    }),
  });
  return sources.length;
}
