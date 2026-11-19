"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import {
  copyDaySchema,
  copySlotSchema,
  createMealFromSlotSchema,
  logExistingProductSchema,
  logProductSchema,
  productMacrosSchema,
  quickAddSchema,
  SLOT_LABELS,
  type CopyDayInput,
  type CopySlotInput,
  type CreateMealFromSlotInput,
  type LogExistingProductInputRaw,
  type LogProductInputRaw,
  type ProductMacrosInputRaw,
  type QuickAddInputRaw,
} from "@/lib/schemas";
import {
  gramsPerServing,
  hasAnyMacro,
  pickMacros,
  sumDayEntries,
} from "@/lib/macros";
import { formatHuman, keyToDbDate } from "@/lib/dates";
import { copyEntries, nextPosition, refreshUpcomingEntries } from "@/lib/entries";

type ActionResult = { ok: true } | { ok: false; error: string };

/** kcal to a whole number, gram macros to one decimal; null stays null. */
function roundMacro(value: number | null, kind: "kcal" | "g"): number | null {
  if (value == null) return null;
  return kind === "kcal" ? Math.round(value) : Math.round(value * 10) / 10;
}

function revalidateDay(date: string) {
  revalidatePath("/today");
  revalidatePath(`/plan/day/${date}`);
  revalidatePath("/plan");
  revalidatePath("/");
}

const MACRO_SELECT = {
  id: true,
  kcal: true,
  protein: true,
  fat: true,
  carbs: true,
  sugar: true,
  fiber: true,
} as const;

/**
 * Save (or correct) a scanned product's macros in our shared database, keyed by
 * barcode. Flips `source` to "user" so a later re-scan returns these values
 * instead of the Open Food Facts data. Macros are stored per 100 g/ml.
 */
export async function upsertProductMacrosAction(
  input: ProductMacrosInputRaw,
): Promise<ActionResult> {
  await requireUserId();
  const parsed = productMacrosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product details." };

  const { barcode, ...rest } = parsed.data;
  const data = { ...rest, source: "user" };
  const product = await prisma.product.upsert({
    where: { barcode },
    create: { barcode, ...data },
    update: data,
    select: MACRO_SELECT,
  });
  await refreshUpcomingEntries({ productId: product.id }, product);

  revalidatePath("/today");
  revalidatePath("/scan");
  return { ok: true };
}

/**
 * Log an eaten quantity (grams) of a scanned product into a day+slot. Caches the
 * product on first log without clobbering an existing user-edited row.
 */
export async function logProductAction(
  input: Omit<LogProductInputRaw, "slot"> & { slot: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = logProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };

  const { date, slot, grams, barcode, ...productFields } = parsed.data;

  // Cache OFF data on first sighting; never overwrite hand-edited macros. The
  // entry copies whatever the row holds afterwards.
  const product = await prisma.product.upsert({
    where: { barcode },
    create: { barcode, ...productFields, source: "openfoodfacts" },
    update: {},
    select: MACRO_SELECT,
  });

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId: product.id,
      grams,
      position: await nextPosition(userId, date, slot),
      ...pickMacros(product),
    },
  });

  revalidateDay(date);
  return { ok: true };
}

/**
 * Log a product we already hold, by id. Unlike `logProductAction` this carries
 * no macro payload — the row is the source of truth.
 */
export async function logExistingProductAction(
  input: Omit<LogExistingProductInputRaw, "slot"> & { slot: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = logExistingProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };

  const { date, slot, productId, grams } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: MACRO_SELECT,
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId,
      grams,
      position: await nextPosition(userId, date, slot),
      ...pickMacros(product),
    },
  });

  revalidateDay(date);
  return { ok: true };
}

/**
 * Log typed-in macros with no product or meal behind them. If kcal is left
 * blank but macros are given, kcal is estimated at 4/4/9 kcal per gram of
 * protein/carbs/fat.
 */
export async function quickAddAction(
  input: Omit<QuickAddInputRaw, "slot"> & { slot: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };

  const { date, slot, label, ...macros } = parsed.data;
  if (!hasAnyMacro(macros)) {
    return { ok: false, error: "Enter at least the calories." };
  }
  for (const v of Object.values(macros)) {
    if (v != null && (v < 0 || v > 20000)) {
      return { ok: false, error: "Those numbers don't look right." };
    }
  }
  const kcal =
    macros.kcal ??
    Math.round(
      (macros.protein ?? 0) * 4 + (macros.carbs ?? 0) * 4 + (macros.fat ?? 0) * 9,
    );

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      label,
      servings: 1,
      position: await nextPosition(userId, date, slot),
      ...macros,
      kcal,
    },
  });

  revalidateDay(date);
  return { ok: true };
}

/**
 * Update the eaten weight (grams) of a logged product, or of a meal from a
 * weighed batch — whose servings are then recomputed from the weight.
 */
export async function setGramsAction(
  id: string,
  grams: number,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!Number.isFinite(grams) || grams <= 0 || grams > 100000) {
    return { ok: false, error: "Grams must be positive." };
  }
  const entry = await prisma.planEntry.findFirst({
    where: { id, userId },
    select: {
      mealId: true,
      productId: true,
      servings: true,
      grams: true,
      meal: { select: { cookedGrams: true, serves: true } },
    },
  });
  if (!entry || (!entry.mealId && !entry.productId)) {
    return { ok: false, error: "Entry not found." };
  }

  let servings = entry.servings;
  if (entry.mealId) {
    // The entry's own grams-per-serving is the batch it was logged from; fall
    // back to the meal's current batch for entries logged before weighing.
    const gps =
      entry.grams != null && entry.servings > 0
        ? entry.grams / entry.servings
        : entry.meal
          ? gramsPerServing(entry.meal)
          : null;
    if (gps == null) {
      return { ok: false, error: "Weigh the batch on the meal first." };
    }
    servings = grams / gps;
  }
  await prisma.planEntry.update({ where: { id }, data: { grams, servings } });
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Turn everything currently logged in a day+slot into a reusable meal. Products
 * become scanned-style ingredients (barcode + per-100 g macros) so the meal
 * stays editable; the meal's own macros are locked to the section's exact totals
 * — this stays correct even when the section also contains other meals or quick
 * adds, which have no per-100 g representation to recompute from.
 */
export async function createMealFromSlotAction(
  input: CreateMealFromSlotInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = createMealFromSlotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const { date, slot, name } = parsed.data;

  const entries = await prisma.planEntry.findMany({
    where: { userId, date: keyToDbDate(date), slot, status: { not: "SKIPPED" } },
    orderBy: { position: "asc" },
    include: {
      meal: { select: { name: true } },
      product: { select: { name: true, barcode: true } },
    },
  });

  if (entries.length === 0) {
    return {
      ok: false,
      error: `Nothing logged in ${SLOT_LABELS[slot]} to turn into a meal.`,
    };
  }

  const totals = sumDayEntries(entries);

  const ingredients = entries.map((e, i) => {
    if (e.product) {
      return {
        name: e.product.name,
        qty: e.grams,
        unit: "g",
        position: i,
        barcode: e.product.barcode,
        ...pickMacros(e),
      };
    }
    return {
      name: e.meal?.name ?? e.label ?? "Quick add",
      qty: e.servings,
      unit: "serving",
      position: i,
    };
  });

  const created = await prisma.meal.create({
    data: {
      userId,
      name,
      serves: 1,
      macrosManual: true,
      kcal: roundMacro(totals.kcal, "kcal"),
      protein: roundMacro(totals.protein, "g"),
      fat: roundMacro(totals.fat, "g"),
      carbs: roundMacro(totals.carbs, "g"),
      sugar: roundMacro(totals.sugar, "g"),
      fiber: roundMacro(totals.fiber, "g"),
      ingredients: { create: ingredients },
    },
    select: { id: true },
  });

  revalidatePath("/library/meals");
  revalidatePath("/today");
  return { ok: true, id: created.id };
}

/**
 * Copy every (non-skipped) entry from one day's slot into another day's same
 * slot — appended after whatever is already there.
 */
export async function copySlotFromDateAction(
  input: CopySlotInput,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = copySlotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { fromDate, toDate, slot } = parsed.data;

  const count = await copyEntries(
    userId,
    { dateFrom: fromDate, dateTo: fromDate, slot },
    () => toDate,
  );
  if (count === 0) {
    return {
      ok: false,
      error: `Nothing logged in ${SLOT_LABELS[slot]} on that day.`,
    };
  }

  revalidateDay(toDate);
  return { ok: true, count };
}

/** Copy a whole day (every slot, non-skipped entries) into another day. */
export async function copyDayAction(
  input: CopyDayInput,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = copyDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { fromDate, toDate } = parsed.data;
  if (fromDate === toDate) {
    return { ok: false, error: "Pick a different day to copy from." };
  }

  const count = await copyEntries(
    userId,
    { dateFrom: fromDate, dateTo: fromDate },
    () => toDate,
  );
  if (count === 0) {
    return { ok: false, error: `Nothing logged on ${formatHuman(fromDate)}.` };
  }

  revalidateDay(toDate);
  return { ok: true, count };
}
