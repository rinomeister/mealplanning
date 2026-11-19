import {
  ZERO_MACROS,
  addMacros,
  scaleGrams,
  scaleMacros,
  type Macros,
  type MealMacros,
} from "@/lib/macros";

/**
 * The design's macro language: one colour class + one letter per macro, always
 * in this order, protein first. Kcal is the ring; these are the bars.
 */
export type GramMacro = "protein" | "carbs" | "fat" | "sugar" | "fiber";

export type MacroUi = {
  key: GramMacro;
  letter: string;
  label: string;
  /** `.m-*` class from globals.css that sets --m / --mt. */
  cls: string;
  /** "goal" = a floor you try to reach; "limit" = a ceiling not to pass. */
  kind: "goal" | "limit";
};

export const MACROS_UI: MacroUi[] = [
  { key: "protein", letter: "P", label: "Protein", cls: "m-p", kind: "goal" },
  { key: "carbs", letter: "C", label: "Carbs", cls: "m-c", kind: "limit" },
  { key: "fat", letter: "F", label: "Fat", cls: "m-f", kind: "limit" },
  { key: "sugar", letter: "S", label: "Sugar", cls: "m-s", kind: "limit" },
  { key: "fiber", letter: "Fi", label: "Fiber", cls: "m-fi", kind: "goal" },
];

export const MACRO_UI_BY_KEY = Object.fromEntries(
  MACROS_UI.map((m) => [m.key, m]),
) as Record<GramMacro, MacroUi>;

const KCAL_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Whole kcal with a thousands separator: 1,532. */
export function fmtKcal(n: number): string {
  return KCAL_FMT.format(Math.round(n));
}

/** Grams: one decimal under 10, whole above. 9.5 · 12 · 0. */
export function fmtG(n: number): string {
  if (Math.abs(n) < 10) {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  return String(Math.round(n));
}

export type Targets = { [K in keyof Macros]: number | null };

/** Per-status day totals: what's eaten, and what's planned but not yet. */
export type DayTotals = { eaten: Macros; planned: Macros };

export type StatusEntry = MealMacros & {
  status: "PLANNED" | "EATEN" | "SKIPPED";
  servings: number;
  grams: number | null;
  productId: string | null;
};

/** Macros of one entry: per 100 g × grams for products, × servings otherwise. */
export function macrosOf(e: Omit<StatusEntry, "status">): Macros {
  if (e.productId) return scaleGrams(e, e.grams ?? 0);
  return scaleMacros(e, e.servings);
}

export function sumByStatus(entries: StatusEntry[]): DayTotals {
  let eaten = { ...ZERO_MACROS };
  let planned = { ...ZERO_MACROS };
  for (const e of entries) {
    if (e.status === "EATEN") eaten = addMacros(eaten, macrosOf(e));
    else if (e.status === "PLANNED") planned = addMacros(planned, macrosOf(e));
  }
  return { eaten, planned };
}
