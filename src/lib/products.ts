import type { MealMacros } from "@/lib/macros";

/** A named portion size on a product, e.g. "1 slice" = 25 g. */
export type Portion = { label: string; grams: number };

/** A product from our own database, as shown in pickers and the Products page. */
export type PickerProduct = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingGrams: number | null;
  per100g: MealMacros;
  portions: Portion[];
};

export const PICKER_PRODUCT_SELECT = {
  id: true,
  name: true,
  brand: true,
  barcode: true,
  servingGrams: true,
  kcal: true,
  protein: true,
  fat: true,
  carbs: true,
  sugar: true,
  fiber: true,
  portions: {
    orderBy: { position: "asc" },
    select: { label: true, grams: true },
  },
} as const;

type PickerProductRow = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingGrams: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sugar: number | null;
  fiber: number | null;
  portions: Portion[];
};

export function toPickerProduct(p: PickerProductRow): PickerProduct {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    barcode: p.barcode,
    servingGrams: p.servingGrams,
    per100g: {
      kcal: p.kcal,
      protein: p.protein,
      fat: p.fat,
      carbs: p.carbs,
      sugar: p.sugar,
      fiber: p.fiber,
    },
    portions: p.portions,
  };
}

/**
 * The quick-pick portion buttons for a product: its "1 serving" weight (when
 * known) followed by any named portions, without duplicates.
 */
export function portionChoices(p: {
  servingGrams: number | null;
  portions?: Portion[];
}): Portion[] {
  const list: Portion[] = [];
  if (p.servingGrams != null) list.push({ label: "serving", grams: p.servingGrams });
  for (const portion of p.portions ?? []) {
    if (!list.some((x) => x.label.toLowerCase() === portion.label.toLowerCase())) {
      list.push(portion);
    }
  }
  return list;
}
