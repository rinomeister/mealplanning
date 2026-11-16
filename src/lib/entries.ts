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

/** How many upcoming, not-yet-eaten entries deleting a meal/product removes. */
export async function countUpcomingEntries(
  ref: { mealId: string } | { productId: string },
  userId?: string,
): Promise<number> {
  const today = keyToDbDate(todayKey());
  return prisma.planEntry.count({
    where: {
      ...ref,
      ...(userId ? { userId } : {}),
      date: { gte: today },
      status: { not: "EATEN" },
    },
  });
}

/**
 * Delete a meal without touching history. Past and eaten entries are detached
 * into named entries ("Beef chili", or "Beef chili · 350 g" when eaten by
 * weight) that keep their own per-serving macros, so old day totals don't
 * move. Upcoming plans for it are removed. Returns the number removed.
 */
export async function deleteMealKeepingHistory(meal: {
  id: string;
  name: string;
}): Promise<number> {
  const today = keyToDbDate(todayKey());
  const results = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "PlanEntry"
      SET "label" = ${meal.name} || CASE WHEN "grams" IS NOT NULL
            THEN ' · ' || ROUND("grams"::numeric)::text || ' g' ELSE '' END,
          "mealId" = NULL, "grams" = NULL
      WHERE "mealId" = ${meal.id} AND ("date" < ${today} OR "status" = 'EATEN')`,
    // What still points at the meal is the upcoming, uneaten plans.
    prisma.planEntry.deleteMany({ where: { mealId: meal.id } }),
    prisma.meal.delete({ where: { id: meal.id } }),
  ]);
  return results[1].count;
}

/**
 * Delete a product without touching anyone's history (products are shared).
 * A product entry scales per-100 g macros by grams; once detached it can't, so
 * its macros become the eaten totals with servings 1, and the label records the
 * amount ("Skyr · 150 g"). Upcoming plans for it are removed.
 */
export async function deleteProductKeepingHistory(product: {
  id: string;
  name: string;
}): Promise<number> {
  const today = keyToDbDate(todayKey());
  const results = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "PlanEntry"
      SET "label" = ${product.name} || ' · ' || ROUND(COALESCE("grams", 0)::numeric)::text || ' g',
          "kcal" = "kcal" * COALESCE("grams", 0) / 100,
          "protein" = "protein" * COALESCE("grams", 0) / 100,
          "fat" = "fat" * COALESCE("grams", 0) / 100,
          "carbs" = "carbs" * COALESCE("grams", 0) / 100,
          "sugar" = "sugar" * COALESCE("grams", 0) / 100,
          "fiber" = "fiber" * COALESCE("grams", 0) / 100,
          "servings" = 1, "grams" = NULL, "productId" = NULL
      WHERE "productId" = ${product.id} AND ("date" < ${today} OR "status" = 'EATEN')`,
    prisma.planEntry.deleteMany({ where: { productId: product.id } }),
    prisma.product.delete({ where: { id: product.id } }),
  ]);
  return results[1].count;
}
