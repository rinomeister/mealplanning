"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import {
  copySlotSchema,
  createMealFromSlotSchema,
  logExistingProductSchema,
  logProductSchema,
  productMacrosSchema,
  SLOT_LABELS,
  type CopySlotInput,
  type CreateMealFromSlotInput,
  type LogExistingProductInputRaw,
  type LogProductInputRaw,
  type ProductMacrosInputRaw,
  type SlotKey,
} from "@/lib/schemas";
import { sumDayEntries, type MealMacros } from "@/lib/macros";
import { keyToDbDate } from "@/lib/dates";

type ActionResult = { ok: true } | { ok: false; error: string };

/** kcal to a whole number, gram macros to one decimal; null stays null. */
function roundMacro(value: number | null, kind: "kcal" | "g"): number | null {
  if (value == null) return null;
  return kind === "kcal" ? Math.round(value) : Math.round(value * 10) / 10;
}

/** Next free position in a day+slot, so new entries append rather than collide. */
async function nextPosition(userId: string, date: string, slot: SlotKey) {
  const last = await prisma.planEntry.findFirst({
    where: { userId, date: keyToDbDate(date), slot },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

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
  await prisma.product.upsert({
    where: { barcode },
    create: { barcode, ...data },
    update: data,
  });

  revalidatePath("/track");
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

  // Cache OFF data on first sighting; never overwrite hand-edited macros.
  const product = await prisma.product.upsert({
    where: { barcode },
    create: { barcode, ...productFields, source: "openfoodfacts" },
    update: {},
    select: { id: true },
  });

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId: product.id,
      grams,
      position: await nextPosition(userId, date, slot),
    },
  });

  revalidatePath("/track");
  revalidatePath(`/calendar/${date}`);
  revalidatePath("/calendar");
  return { ok: true };
}

/**
 * Log a product we already hold, by id. Unlike `logProductAction` this carries
 * no macro payload — the row is the source of truth, so a product corrected on
 * the Products page stays corrected everywhere.
 */
export async function logExistingProductAction(
  input: Omit<LogExistingProductInputRaw, "slot"> & { slot: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = logExistingProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };

  const { date, slot, productId, grams } = parsed.data;

  const exists = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!exists) return { ok: false, error: "That product no longer exists." };

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId,
      grams,
      position: await nextPosition(userId, date, slot),
    },
  });

  revalidatePath("/track");
  revalidatePath(`/calendar/${date}`);
  revalidatePath("/calendar");
  return { ok: true };
}

/** Update the eaten weight (grams) of a logged product entry. */
export async function setGramsAction(
  id: string,
  grams: number,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!Number.isFinite(grams) || grams <= 0) {
    return { ok: false, error: "Grams must be positive." };
  }
  const { count } = await prisma.planEntry.updateMany({
    where: { id, userId },
    data: { grams },
  });
  if (count === 0) return { ok: false, error: "Entry not found." };
  revalidatePath("/track");
  revalidatePath("/calendar");
  return { ok: true };
}

const macrosOf = (m: MealMacros): MealMacros => ({
  kcal: m.kcal,
  protein: m.protein,
  fat: m.fat,
  carbs: m.carbs,
  sugar: m.sugar,
  fiber: m.fiber,
});

/**
 * Turn everything currently logged in a day+slot into a reusable meal. Products
 * become scanned-style ingredients (barcode + per-100 g macros) so the meal
 * stays editable; the meal's own macros are locked to the section's exact totals
 * — this stays correct even when the section also contains other meals, which
 * have no per-100 g representation to recompute from.
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
      meal: {
        select: {
          name: true,
          kcal: true,
          protein: true,
          fat: true,
          carbs: true,
          sugar: true,
          fiber: true,
        },
      },
      product: {
        select: {
          name: true,
          barcode: true,
          kcal: true,
          protein: true,
          fat: true,
          carbs: true,
          sugar: true,
          fiber: true,
        },
      },
    },
  });

  if (entries.length === 0) {
    return {
      ok: false,
      error: `Nothing logged in ${SLOT_LABELS[slot]} to turn into a meal.`,
    };
  }

  const totals = sumDayEntries(
    entries.map((e) => ({
      servings: e.servings,
      grams: e.grams,
      meal: e.meal ? macrosOf(e.meal) : null,
      product: e.product ? macrosOf(e.product) : null,
    })),
  );

  const ingredients = entries.map((e, i) => {
    if (e.product) {
      return {
        name: e.product.name,
        qty: e.grams,
        unit: "g",
        position: i,
        barcode: e.product.barcode,
        kcal: e.product.kcal,
        protein: e.product.protein,
        fat: e.product.fat,
        carbs: e.product.carbs,
        sugar: e.product.sugar,
        fiber: e.product.fiber,
      };
    }
    return {
      name: e.meal?.name ?? "(removed)",
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

  revalidatePath("/meals");
  revalidatePath("/track");
  return { ok: true, id: created.id };
}

/**
 * Copy every (non-skipped) entry from one day's slot into another day's same
 * slot — appended after whatever is already there, brought in as counted.
 */
export async function copySlotFromDateAction(
  input: CopySlotInput,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = copySlotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { fromDate, toDate, slot } = parsed.data;

  const source = await prisma.planEntry.findMany({
    where: {
      userId,
      date: keyToDbDate(fromDate),
      slot,
      status: { not: "SKIPPED" },
    },
    orderBy: { position: "asc" },
    select: { mealId: true, productId: true, servings: true, grams: true },
  });

  if (source.length === 0) {
    return {
      ok: false,
      error: `Nothing logged in ${SLOT_LABELS[slot]} on that day.`,
    };
  }

  const start = await nextPosition(userId, toDate, slot);
  await prisma.planEntry.createMany({
    data: source.map((s, i) => ({
      userId,
      date: keyToDbDate(toDate),
      slot,
      mealId: s.mealId,
      productId: s.productId,
      servings: s.servings,
      grams: s.grams,
      position: start + i,
    })),
  });

  revalidatePath("/track");
  revalidatePath(`/calendar/${toDate}`);
  revalidatePath("/calendar");
  return { ok: true, count: source.length };
}
