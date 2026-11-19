import type { GramMacro } from "@/lib/macro-format";

/** The rows on Me that open the one-field edit screen (/me/edit/[key]). */
export type ProfileField = "kcal" | GramMacro | "name" | "height";

type FieldDef = {
  label: string;
  column: "targetKcal" | "targetProtein" | "targetCarbs" | "targetFat" | "targetSugar" | "targetFiber" | "name" | "heightCm";
  kind: "int" | "decimal" | "text";
  unit: string;
  max: number;
  /** Short line under the field. */
  hint?: string;
};

export const PROFILE_FIELDS: Record<ProfileField, FieldDef> = {
  kcal: { label: "Calories", column: "targetKcal", kind: "int", unit: "kcal", max: 10000 },
  protein: { label: "Protein", column: "targetProtein", kind: "int", unit: "g", max: 1000 },
  carbs: { label: "Carbs", column: "targetCarbs", kind: "int", unit: "g", max: 2000 },
  fat: { label: "Fat", column: "targetFat", kind: "int", unit: "g", max: 1000 },
  sugar: { label: "Sugar (limit)", column: "targetSugar", kind: "int", unit: "g", max: 1000, hint: "A ceiling: the bar turns red past it." },
  fiber: { label: "Fiber", column: "targetFiber", kind: "int", unit: "g", max: 500 },
  name: { label: "Name", column: "name", kind: "text", unit: "", max: 80 },
  height: { label: "Height", column: "heightCm", kind: "decimal", unit: "cm", max: 300 },
};

/** Order of the target rows, and of ‹ › on the edit screen. */
export const TARGET_KEYS: ProfileField[] = ["kcal", "protein", "carbs", "fat", "sugar", "fiber"];

/** Used when someone skips setting targets after sign-up. */
export const DEFAULT_TARGETS = {
  targetKcal: 2200,
  targetProtein: 140,
  targetCarbs: 240,
  targetFat: 70,
  targetSugar: 50,
  targetFiber: 30,
} as const;

/** kcal from P/C/F grams (4/4/9). */
export function pcfKcal(p: number, c: number, f: number): number {
  return p * 4 + c * 4 + f * 9;
}
