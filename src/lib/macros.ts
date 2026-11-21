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

/** True if any macro is filled in — an all-null product can't be counted. */
export function hasAnyMacro(m: MealMacros): boolean {
  return (
    m.kcal != null ||
    m.protein != null ||
    m.fat != null ||
    m.carbs != null ||
    m.sugar != null ||
    m.fiber != null
  );
}

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
 * Grams in one serving of a meal whose whole cooked batch was weighed, or null
 * when it wasn't. Logging 350 g of it is then 350 / gramsPerServing servings.
 */
export function gramsPerServing(meal: {
  cookedGrams: number | null;
  serves: number;
}): number | null {
  if (meal.cookedGrams == null || meal.cookedGrams <= 0 || meal.serves <= 0) {
    return null;
  }
  return meal.cookedGrams / meal.serves;
}

/** Copy just the six macro columns off any row that has them. */
export function pickMacros(m: MealMacros): MealMacros {
  return {
    kcal: m.kcal,
    protein: m.protein,
    fat: m.fat,
    carbs: m.carbs,
    sugar: m.sugar,
    fiber: m.fiber,
  };
}

/**
 * A day entry carries its own macro basis (copied in when it was logged):
 * per 100 g for products, scaled by `grams`; per serving for meals and quick
 * adds, scaled by `servings`. Entries with no macro data contribute zero.
 */
export type EntryForMacros = MealMacros & {
  servings: number;
  grams: number | null;
  productId: string | null;
};

export function entryMacros(e: EntryForMacros): Macros {
  if (e.productId) return scaleGrams(e, e.grams ?? 0);
  return scaleMacros(e, e.servings);
}

/** Sum a day's entries (meals and products) into a single total. */
export function sumDayEntries(entries: EntryForMacros[]): Macros {
  return entries.reduce((acc, e) => addMacros(acc, entryMacros(e)), {
    ...ZERO_MACROS,
  });
}

/**
 * Whether passing the target is a failure or the whole point. Protein and fibre
 * targets are floors you're trying to reach; kcal, fat, carbs and sugar are
 * ceilings. Only a blown ceiling turns red.
 */
export type MacroKind = "limit" | "goal";

export type MacroMeta = {
  key: Exclude<keyof Macros, "kcal">;
  label: string;
  /** Matching `--macro-*` token from globals.css. */
  color: string;
  kind: MacroKind;
};

/** Display metadata for the gram macros; kcal gets its own treatment. */
export const MACRO_META: MacroMeta[] = [
  { key: "protein", label: "Protein", color: "var(--macro-protein)", kind: "goal" },
  { key: "fat", label: "Fat", color: "var(--macro-fat)", kind: "limit" },
  { key: "carbs", label: "Carbs", color: "var(--macro-carbs)", kind: "limit" },
  { key: "sugar", label: "Sugar", color: "var(--macro-sugar)", kind: "limit" },
  { key: "fiber", label: "Fiber", color: "var(--macro-fiber)", kind: "goal" },
];

/** Round a macro value for display (kcal whole, grams to 1 decimal). */
export function fmtMacro(value: number, kind: "kcal" | "g" = "g"): string {
  if (kind === "kcal") return Math.round(value).toString();
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

/** An ingredient measured in servings (a meal or quick add folded into a meal)
 * carries per-serving macros; any other unit means per 100 g/ml. */
export function isServingUnit(unit: string | null | undefined): boolean {
  return /^servings?$/i.test((unit ?? "").trim());
}

/** One meal ingredient's contribution, or null when it can't be counted. */
export function ingredientMacros(row: MealMacros & { qty: number | null; unit: string | null }): Macros | null {
  if (!hasAnyMacro(row) || row.qty == null || !(row.qty > 0)) return null;
  return isServingUnit(row.unit) ? scaleMacros(row, row.qty) : scaleGrams(row, row.qty);
}
