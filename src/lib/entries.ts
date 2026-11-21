import { prisma } from "@/lib/prisma";
import {
  addMacros,
  gramsPerServing,
  ingredientMacros,
  isServingUnit,
  pickMacros,
  ZERO_MACROS,
  type Macros,
  type MealMacros,
} from "@/lib/macros";
import { dbDateToKey, keyToDbDate, type DateKey } from "@/lib/dates";
import { userNow } from "@/lib/user-time";
import type { SlotKey } from "@/lib/schemas";

/** Midnight of the user's today (their time zone, not the server's). */
async function userTodayDb(): Promise<Date> {
  return keyToDbDate((await userNow()).today);
}

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
    where: { ...ref, date: { gte: await userTodayDb() } },
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
  const today = await userTodayDb();
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
 * Copy existing entries to new day(s), returning the new entries' ids (so a
 * copy can be undone). `place` maps each source entry to its
 * target date (and keeps the slot). Copies come in as PLANNED, appended after
 * whatever each target day+slot already holds. Meals and products take their
 * *current* macros — a copy is a fresh entry — while quick adds carry theirs
 * over, having nothing else to read from.
 */
export async function copyEntries(
  userId: string,
  where: { dateFrom: DateKey; dateTo: DateKey; slot?: SlotKey; slots?: SlotKey[] },
  place: (sourceDate: DateKey) => DateKey,
  /** Put every copy in this slot instead of its own (desktop drag to another cell). */
  slotTo?: SlotKey,
): Promise<string[]> {
  const sources = await prisma.planEntry.findMany({
    where: {
      userId,
      date: { gte: keyToDbDate(where.dateFrom), lte: keyToDbDate(where.dateTo) },
      ...(where.slot ? { slot: where.slot } : {}),
      ...(where.slots ? { slot: { in: where.slots } } : {}),
      status: { not: "SKIPPED" },
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }, { position: "asc" }],
    include: {
      meal: { select: { ...MACRO_SELECT, cookedGrams: true, serves: true } },
      product: { select: MACRO_SELECT },
    },
  });
  if (sources.length === 0) return [];

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

  const created = await prisma.planEntry.createManyAndReturn({
    select: { id: true },
    data: sources.map((s) => {
      const date = place(dbDateToKey(s.date));
      const slot = slotTo ?? s.slot;
      const key = `${date}|${slot}`;
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
        slot,
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
  return created.map((c) => c.id);
}

/** How many upcoming, not-yet-eaten entries deleting a meal/product removes. */
export async function countUpcomingEntries(
  ref: { mealId: string } | { productId: string },
  userId?: string,
): Promise<number> {
  const today = await userTodayDb();
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
  const today = await userTodayDb();
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
  const today = await userTodayDb();
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

const MEAL_MACRO_KEYS = ["kcal", "protein", "fat", "carbs", "sugar", "fiber"] as const;
type IngredientForTotals = MealMacros & { qty: number | null; unit: string | null };

function sumIngredients(rows: IngredientForTotals[]): Macros {
  return rows.reduce<Macros>((acc, r) => {
    const m = ingredientMacros(r);
    return m ? addMacros(acc, m) : acc;
  }, { ...ZERO_MACROS });
}

/**
 * Whether a meal's stored macros follow its ingredients. A meal marked "entered
 * by hand" still follows them when the stored numbers are just the ingredient
 * totals (older saves set the flag whenever nothing was countable yet).
 */
function followsIngredients(
  meal: MealMacros & { macrosManual: boolean; serves: number },
  rows: IngredientForTotals[],
): boolean {
  if (rows.length === 0 || !rows.some((r) => ingredientMacros(r))) return false;
  if (!meal.macrosManual) return true;
  if (!rows.every((r) => ingredientMacros(r))) return false;
  const batch = sumIngredients(rows);
  const serves = meal.serves > 0 ? meal.serves : 1;
  return MEAL_MACRO_KEYS.every(
    (k) => Math.abs((meal[k] ?? 0) - batch[k] / serves) <= (k === "kcal" ? 1.5 : 0.6),
  );
}

/**
 * After a product's macros change, update the copies held by meal ingredients
 * (matched by barcode, or by name for hand-entered foods with no barcode) and
 * recompute those meals' totals, which then flow into today's and future plans.
 * Meals whose macros were genuinely entered by hand keep them.
 */
export async function syncMealsUsingProduct(
  before: { name: string; barcode: string | null },
  after: MealMacros & { name: string },
) {
  const where = before.barcode
    ? { barcode: before.barcode }
    : { barcode: null, name: before.name, NOT: { unit: { in: ["serving", "servings"] } } };
  const hits = await prisma.ingredient.findMany({ where, select: { mealId: true } });
  if (hits.length === 0) return;
  const mealIds = [...new Set(hits.map((h) => h.mealId))];

  const macroSelect = { kcal: true, protein: true, fat: true, carbs: true, sugar: true, fiber: true } as const;
  const meals = await prisma.meal.findMany({
    where: { id: { in: mealIds } },
    select: {
      id: true,
      serves: true,
      macrosManual: true,
      ...macroSelect,
      ingredients: { select: { qty: true, unit: true, barcode: true, name: true, ...macroSelect } },
    },
  });
  // Decide before the update: whether each meal follows its ingredients.
  const following = new Set(meals.filter((m) => followsIngredients(m, m.ingredients)).map((m) => m.id));

  await prisma.ingredient.updateMany({ where, data: { name: after.name, ...pickMacros(after) } });

  const macros = pickMacros(after);
  const matches = (r: { barcode: string | null; name: string; unit: string | null }) =>
    before.barcode ? r.barcode === before.barcode : r.barcode == null && r.name === before.name && !isServingUnit(r.unit);
  for (const meal of meals) {
    if (!following.has(meal.id)) continue;
    const rows = meal.ingredients.map((r) => (matches(r) ? { ...r, ...macros } : r));
    const batch = sumIngredients(rows);
    const serves = meal.serves > 0 ? meal.serves : 1;
    const perServing = Object.fromEntries(
      MEAL_MACRO_KEYS.map((k) => [k, Math.round((batch[k] / serves) * 100) / 100]),
    ) as MealMacros;
    await prisma.meal.update({ where: { id: meal.id }, data: { ...perServing, macrosManual: false } });
    await refreshUpcomingEntries({ mealId: meal.id }, perServing);
  }
}
