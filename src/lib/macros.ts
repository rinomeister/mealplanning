export type Macros = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

export type MealMacros = {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
};

export function scaleMacros(meal: MealMacros, servings: number): Macros {
  return {
    kcal: (meal.kcal ?? 0) * servings,
    protein: (meal.protein ?? 0) * servings,
    fat: (meal.fat ?? 0) * servings,
    carbs: (meal.carbs ?? 0) * servings,
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
  };
}

/** Sum scaled macros over a set of plan entries. */
export function sumEntries(
  entries: { servings: number; meal: MealMacros }[],
): Macros {
  return entries.reduce(
    (acc, e) => addMacros(acc, scaleMacros(e.meal, e.servings)),
    { ...ZERO_MACROS },
  );
}

/** Round a macro value for display (kcal whole, grams to 1 decimal). */
export function fmtMacro(value: number, kind: "kcal" | "g" = "g"): string {
  if (kind === "kcal") return Math.round(value).toString();
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}
