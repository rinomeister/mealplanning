"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import {
  SLOTS,
  type SlotKey,
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
import { addDaysKey, dbDateToKey, formatHuman, keyToDbDate, todayKey } from "@/lib/dates";
import { copyEntries, nextPosition, refreshUpcomingEntries } from "@/lib/entries";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type IdsResult = { ok: true; ids: string[] } | { ok: false; error: string };

/** Logged from Today (today or earlier) means eaten; from Plan, planned. */
type LogOptions = { eaten?: boolean };
const statusFor = (opts: LogOptions) => (opts.eaten ? "EATEN" : "PLANNED");

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
  opts: LogOptions = {},
): Promise<CreateResult> {
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

  const created = await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId: product.id,
      grams,
      status: statusFor(opts),
      position: await nextPosition(userId, date, slot),
      ...pickMacros(product),
    },
    select: { id: true },
  });

  revalidateDay(date);
  return { ok: true, id: created.id };
}

/**
 * Log a product we already hold, by id. Unlike `logProductAction` this carries
 * no macro payload — the row is the source of truth.
 */
export async function logExistingProductAction(
  input: Omit<LogExistingProductInputRaw, "slot"> & { slot: string },
  opts: LogOptions = {},
): Promise<CreateResult> {
  const userId = await requireUserId();
  const parsed = logExistingProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };

  const { date, slot, productId, grams } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: MACRO_SELECT,
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  const created = await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId,
      grams,
      status: statusFor(opts),
      position: await nextPosition(userId, date, slot),
      ...pickMacros(product),
    },
    select: { id: true },
  });

  revalidateDay(date);
  return { ok: true, id: created.id };
}

/**
 * Log typed-in macros with no product or meal behind them. If kcal is left
 * blank but macros are given, kcal is estimated at 4/4/9 kcal per gram of
 * protein/carbs/fat.
 */
export async function quickAddAction(
  input: Omit<QuickAddInputRaw, "slot"> & { slot: string },
  opts: LogOptions = {},
): Promise<CreateResult> {
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

  const created = await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      label,
      servings: 1,
      status: statusFor(opts),
      position: await nextPosition(userId, date, slot),
      ...macros,
      kcal,
    },
    select: { id: true },
  });

  revalidateDay(date);
  return { ok: true, id: created.id };
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
): Promise<{ ok: true; count: number; ids: string[] } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = copySlotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { fromDate, toDate, slot } = parsed.data;

  const ids = await copyEntries(
    userId,
    { dateFrom: fromDate, dateTo: fromDate, slot },
    () => toDate,
  );
  if (ids.length === 0) {
    return {
      ok: false,
      error: `Nothing logged in ${SLOT_LABELS[slot]} on that day.`,
    };
  }

  revalidateDay(toDate);
  return { ok: true, count: ids.length, ids };
}

/** Copy a whole day (every slot, non-skipped entries) into another day. */
export async function copyDayAction(
  input: CopyDayInput,
): Promise<{ ok: true; count: number; ids: string[] } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = copyDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { fromDate, toDate } = parsed.data;
  if (fromDate === toDate) {
    return { ok: false, error: "Pick a different day to copy from." };
  }

  const ids = await copyEntries(
    userId,
    { dateFrom: fromDate, dateTo: fromDate },
    () => toDate,
  );
  if (ids.length === 0) {
    return { ok: false, error: `Nothing logged on ${formatHuman(fromDate)}.` };
  }

  revalidateDay(toDate);
  return { ok: true, count: ids.length, ids };
}

const SLOT_SET = new Set<string>(SLOTS);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Move one entry into another slot on the same day, at the end. */
export async function moveEntryAction(id: string, slot: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!SLOT_SET.has(slot)) return { ok: false, error: "Unknown slot." };
  const entry = await prisma.planEntry.findFirst({
    where: { id, userId },
    select: { date: true, slot: true },
  });
  if (!entry) return { ok: false, error: "Entry not found." };
  if (entry.slot === slot) return { ok: true };
  const date = dbDateToKey(entry.date);
  await prisma.planEntry.update({
    where: { id },
    data: { slot: slot as SlotKey, position: await nextPosition(userId, date, slot as SlotKey) },
  });
  revalidateDay(date);
  return { ok: true };
}

/** Copy one entry to the same slot on another day, as planned. */
export async function copyEntryToDateAction(id: string, toDate: string): Promise<CreateResult> {
  const userId = await requireUserId();
  if (!DATE_RE.test(toDate)) return { ok: false, error: "Pick a day." };
  const entry = await prisma.planEntry.findFirst({ where: { id, userId } });
  if (!entry) return { ok: false, error: "Entry not found." };
  const created = await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(toDate),
      slot: entry.slot,
      mealId: entry.mealId,
      productId: entry.productId,
      servings: entry.servings,
      grams: entry.grams,
      label: entry.label,
      position: await nextPosition(userId, toDate, entry.slot),
      ...pickMacros(entry),
    },
    select: { id: true },
  });
  revalidateDay(toDate);
  return { ok: true, id: created.id };
}

/** Mark every planned entry in a day+slot as eaten. */
export async function markSlotEatenAction(date: string, slot: string): Promise<IdsResult> {
  const userId = await requireUserId();
  if (!DATE_RE.test(date) || !SLOT_SET.has(slot)) return { ok: false, error: "Invalid request." };
  const where = { userId, date: keyToDbDate(date), slot: slot as SlotKey, status: "PLANNED" as const };
  const rows = await prisma.planEntry.findMany({ where, select: { id: true } });
  await prisma.planEntry.updateMany({ where, data: { status: "EATEN" } });
  revalidateDay(date);
  return { ok: true, ids: rows.map((r) => r.id) };
}

/** Set several entries back to a status — undo for "mark all eaten". */
export async function setEntriesStatusAction(
  ids: string[],
  status: "PLANNED" | "EATEN" | "SKIPPED",
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (ids.length === 0) return { ok: true };
  await prisma.planEntry.updateMany({ where: { id: { in: ids }, userId }, data: { status } });
  revalidateDay(todayKey());
  return { ok: true };
}

/** Delete several entries at once (clearing a slot, undoing a copy). */
export async function removeEntriesAction(ids: string[]): Promise<ActionResult> {
  const userId = await requireUserId();
  if (ids.length === 0) return { ok: true };
  await prisma.planEntry.deleteMany({ where: { id: { in: ids }, userId } });
  revalidateDay(todayKey());
  return { ok: true };
}

export type RecentItem = {
  kind: "product" | "meal";
  id: string;
  name: string;
  servings: number;
  grams: number | null;
  /** "1 scoop · 30 g", "250 g", "1 bowl". */
  amount: string;
  kcal: number;
  protein: number;
};

const r1 = (n: number) => (Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n));

/**
 * What the Add sheet shows for a day+slot: the last few things logged (each
 * once, with the amount used last time) and what yesterday's same slot held.
 */
export async function getAddSheetDataAction(
  date: string,
  slot: string,
): Promise<{ recents: RecentItem[]; yesterday: { names: string[]; kcal: number } | null }> {
  const userId = await requireUserId();
  if (!DATE_RE.test(date) || !SLOT_SET.has(slot)) return { recents: [], yesterday: null };

  const [rows, prev] = await Promise.all([
    prisma.planEntry.findMany({
      where: { userId, OR: [{ productId: { not: null } }, { mealId: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        product: { select: { name: true, servingGrams: true, portions: { select: { label: true, grams: true } } } },
        meal: { select: { name: true, servingLabel: true } },
      },
    }),
    prisma.planEntry.findMany({
      where: {
        userId,
        date: keyToDbDate(addDaysKey(date, -1)),
        slot: slot as SlotKey,
        status: { not: "SKIPPED" },
      },
      include: { product: { select: { name: true } }, meal: { select: { name: true } } },
    }),
  ]);

  const seen = new Set<string>();
  const recents: RecentItem[] = [];
  for (const e of rows) {
    const key = e.productId ? `p${e.productId}` : `m${e.mealId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.product && e.productId) {
      const g = e.grams ?? 0;
      const portion = [
        ...(e.product.servingGrams ? [{ label: "serving", grams: e.product.servingGrams }] : []),
        ...e.product.portions,
      ].find((p) => p.grams > 0 && Math.abs(g - p.grams) < 0.5);
      recents.push({
        kind: "product",
        id: e.productId,
        name: e.product.name,
        servings: 1,
        grams: g,
        amount: portion ? `1 ${portion.label} · ${r1(g)} g` : `${r1(g)} g`,
        kcal: ((e.kcal ?? 0) * g) / 100,
        protein: ((e.protein ?? 0) * g) / 100,
      });
    } else if (e.meal && e.mealId) {
      recents.push({
        kind: "meal",
        id: e.mealId,
        name: e.meal.name,
        servings: e.servings,
        grams: e.grams,
        amount:
          e.grams != null
            ? `${r1(e.grams)} g`
            : `${r1(e.servings)} ${e.meal.servingLabel?.replace(/^1\s+/, "") ?? (e.servings === 1 ? "serving" : "servings")}`,
        kcal: (e.kcal ?? 0) * e.servings,
        protein: (e.protein ?? 0) * e.servings,
      });
    }
    if (recents.length >= 5) break;
  }

  const yesterday =
    prev.length === 0
      ? null
      : {
          names: prev.map((e) => e.product?.name ?? e.meal?.name ?? e.label ?? "Quick add"),
          kcal: sumDayEntries(prev).kcal,
        };
  return { recents, yesterday };
}
