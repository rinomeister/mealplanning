import { gramsPerServing, hasAnyMacro, pickMacros, type MealMacros } from "@/lib/macros";
import type { Portion } from "@/lib/products";
import type { SlotKey } from "@/lib/schemas";

/**
 * A rendered day entry — a meal (scaled by `servings`), a product (scaled by
 * `grams`) or a quick add (fixed macros). `basis` is the entry's own copy of
 * the macros: per serving for meals and quick adds, per 100 g for products.
 * `hasMacros` is false when there's no nutrition to count.
 */
export type DayEntry = {
  id: string;
  slot: SlotKey;
  kind: "meal" | "product" | "quick";
  name: string;
  href: string | null;
  mealId: string | null;
  productId: string | null;
  servings: number;
  grams: number | null;
  status: "PLANNED" | "EATEN" | "SKIPPED";
  basis: MealMacros;
  /** basis.kcal, kept for older callers. */
  kcalBasis: number | null;
  hasMacros: boolean;
  /**
   * Meals from a weighed batch: grams in one serving, so the row can show and
   * edit grams. The entry's own ratio wins (it's the batch it was logged from);
   * otherwise the meal's current batch.
   */
  gramsPerServing: number | null;
  /** Products: one-tap portions ("1 pot", "1 slice") for the amount editor. */
  servingGrams: number | null;
  portions: Portion[];
};

type EntryRow = MealMacros & {
  id: string;
  slot: string;
  servings: number;
  grams: number | null;
  status: "PLANNED" | "EATEN" | "SKIPPED";
  label: string | null;
  mealId: string | null;
  productId: string | null;
  meal: { name: string; cookedGrams?: number | null; serves?: number } | null;
  product: {
    name: string;
    servingGrams?: number | null;
    portions?: Portion[];
  } | null;
};

export function toDayEntry(e: EntryRow): DayEntry {
  const kind = e.productId ? "product" : e.mealId ? "meal" : "quick";
  return {
    id: e.id,
    slot: e.slot as SlotKey,
    kind,
    name:
      e.product?.name ??
      e.meal?.name ??
      (kind === "quick" ? e.label || "Quick add" : "(removed)"),
    href: e.mealId ? `/meals/${e.mealId}` : null,
    mealId: e.mealId,
    productId: e.productId,
    servings: e.servings,
    grams: e.grams,
    status: e.status,
    basis: pickMacros(e),
    kcalBasis: e.kcal,
    hasMacros: hasAnyMacro(e),
    gramsPerServing:
      kind !== "meal"
        ? null
        : e.grams != null && e.servings > 0
          ? e.grams / e.servings
          : e.meal?.cookedGrams != null && e.meal.serves != null
            ? gramsPerServing({ cookedGrams: e.meal.cookedGrams, serves: e.meal.serves })
            : null,
    servingGrams: e.product?.servingGrams ?? null,
    portions: e.product?.portions ?? [],
  };
}
