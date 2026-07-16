export type Macros = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar: number;
  fiber: number;
};

export const ZERO_MACROS: Macros = {
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  sugar: 0,
  fiber: 0,
};

export type MealMacros = {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sugar: number | null;
  fiber: number | null;
};

/** Scale per-serving macros by a serving count (meals). */
export function scaleMacros(meal: MealMacros, servings: number): Macros {
  return {
    kcal: (meal.kcal ?? 0) * servings,
    protein: (meal.protein ?? 0) * servings,
    fat: (meal.fat ?? 0) * servings,
    carbs: (meal.carbs ?? 0) * servings,
    sugar: (meal.sugar ?? 0) * servings,
    fiber: (meal.fiber ?? 0) * servings,
  };
}

/** Scale per-100g macros by an eaten weight in grams (scanned products). */
export function scaleGrams(per100g: MealMacros, grams: number): Macros {
  return scaleMacros(per100g, grams / 100);
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    sugar: a.sugar + b.sugar,
    fiber: a.fiber + b.fiber,
  };
}

/**
 * A day entry references either a meal (scaled by `servings`) or a scanned
 * product (per-100g macros scaled by `grams`). `entryMacros` resolves whichever
 * applies; entries with no macro data contribute zero.
 */
export type EntryForMacros = {
  servings: number;
  grams: number | null;
  meal: MealMacros | null;
  product: MealMacros | null;
};

export function entryMacros(e: EntryForMacros): Macros {
  if (e.product) return scaleGrams(e.product, e.grams ?? 0);
  if (e.meal) return scaleMacros(e.meal, e.servings);
  return { ...ZERO_MACROS };
}

/** Sum a day's entries (meals and products) into a single total. */
export function sumDayEntries(entries: EntryForMacros[]): Macros {
  return entries.reduce((acc, e) => addMacros(acc, entryMacros(e)), {
    ...ZERO_MACROS,
  });
}

/** Round a macro value for display (kcal whole, grams to 1 decimal). */
export function fmtMacro(value: number, kind: "kcal" | "g" = "g"): string {
  if (kind === "kcal") return Math.round(value).toString();
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}
