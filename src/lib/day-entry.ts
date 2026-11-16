import { hasAnyMacro, type MealMacros } from "@/lib/macros";

/**
 * A rendered day entry — a meal (scaled by `servings`), a product (scaled by
 * `grams`) or a quick add (fixed macros). `kcalBasis` is per serving for meals
 * and quick adds and per 100 g for products, read from the entry's own copy of
 * the macros. `hasMacros` is false when there's no nutrition to count.
 */
export type DayEntry = {
  id: string;
  kind: "meal" | "product" | "quick";
  name: string;
  href: string | null;
  servings: number;
  grams: number | null;
  status: "PLANNED" | "EATEN" | "SKIPPED";
  kcalBasis: number | null;
  hasMacros: boolean;
};

type EntryRow = MealMacros & {
  id: string;
  servings: number;
  grams: number | null;
  status: "PLANNED" | "EATEN" | "SKIPPED";
  label: string | null;
  mealId: string | null;
  productId: string | null;
  meal: { name: string } | null;
  product: { name: string } | null;
};

export function toDayEntry(e: EntryRow): DayEntry {
  const kind = e.productId ? "product" : e.mealId ? "meal" : "quick";
  return {
    id: e.id,
    kind,
    name:
      e.product?.name ??
      e.meal?.name ??
      (kind === "quick" ? e.label || "Quick add" : "(removed)"),
    href: e.mealId ? `/meals/${e.mealId}` : null,
    servings: e.servings,
    grams: e.grams,
    status: e.status,
    kcalBasis: e.kcal,
    hasMacros: hasAnyMacro(e),
  };
}
