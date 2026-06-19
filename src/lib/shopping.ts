import { formatQtyUnit } from "@/lib/format";

export type ShoppingItem = {
  key: string;
  name: string;
  unit: string | null;
  totalQty: number | null;
  hasUnquantified: boolean;
};

type EntryForShopping = {
  servings: number;
  meal: {
    ingredients: { name: string; qty: number | null; unit: string | null }[];
  };
};

export function normalizeKey(name: string, unit: string | null): string {
  return `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
}

/**
 * Aggregate ingredients across plan entries. Items with the same name+unit are
 * summed (qty × servings); unquantified entries are flagged so the UI can show
 * "+ some" rather than a wrong total.
 */
export function aggregateIngredients(
  entries: EntryForShopping[],
): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();

  for (const entry of entries) {
    for (const ing of entry.meal.ingredients) {
      const name = ing.name.trim();
      if (!name) continue;
      const unit = ing.unit?.trim() || null;
      const key = normalizeKey(name, unit);
      const scaled = ing.qty != null ? ing.qty * entry.servings : null;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name,
          unit,
          totalQty: scaled,
          hasUnquantified: scaled == null,
        });
      } else if (scaled != null) {
        existing.totalQty = (existing.totalQty ?? 0) + scaled;
      } else {
        existing.hasUnquantified = true;
      }
    }
  }

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function formatShoppingAmount(item: ShoppingItem): string {
  if (item.totalQty == null) return "";
  const base = formatQtyUnit(item.totalQty, item.unit);
  return item.hasUnquantified ? `${base} +` : base;
}
