import { formatQtyUnit } from "@/lib/format";

export type ShoppingItem = {
  key: string;
  name: string;
  unit: string | null;
  totalQty: number | null;
  hasUnquantified: boolean;
  /** Where it comes from: "Skyr oat bowl" ×4 servings, "Snack 2" ×1 entry. */
  sources: { label: string; count: number }[];
};

type EntryForShopping = {
  servings: number;
  /** Label for the "where from" line: the meal's name, or the slot for a product. */
  source?: string;
  /** How much this entry adds to the source count (servings for meals, 1 for products). */
  sourceCount?: number;
  meal: {
    ingredients: { name: string; qty: number | null; unit: string | null }[];
  };
};

/**
 * Units we know how to convert, by family. Each maps to a factor onto the
 * family's base unit (g for mass, ml for volume). Anything not listed is kept
 * exactly as typed and only merges with the identical unit.
 */
const UNIT_FACTORS: Record<string, { base: "g" | "ml"; factor: number }> = {
  mg: { base: "g", factor: 0.001 },
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  oz: { base: "g", factor: 28.3495 },
  lb: { base: "g", factor: 453.592 },
  ml: { base: "ml", factor: 1 },
  cl: { base: "ml", factor: 10 },
  dl: { base: "ml", factor: 100 },
  l: { base: "ml", factor: 1000 },
  tsp: { base: "ml", factor: 5 },
  tbsp: { base: "ml", factor: 15 },
  cup: { base: "ml", factor: 240 },
};

/** Spelling variants → the canonical unit used above. */
const UNIT_ALIASES: Record<string, string> = {
  gr: "g", gram: "g", grams: "g", gramm: "g",
  kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  milligram: "mg", milligrams: "mg",
  ounce: "oz", ounces: "oz",
  lbs: "lb", pound: "lb", pounds: "lb",
  millilitre: "ml", milliliter: "ml", millilitres: "ml", milliliters: "ml",
  litre: "l", liter: "l", litres: "l", liters: "l", ltr: "l",
  teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp",
  tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", tbsps: "tbsp",
  cups: "cup",
  pc: "pcs", piece: "pcs", pieces: "pcs", pcs: "pcs", kom: "pcs",
};

/** Lower-case, trim, drop a trailing dot ("tbsp.") and resolve aliases. */
export function canonicalUnit(unit: string | null): string | null {
  const u = unit?.trim().toLowerCase().replace(/\.$/, "");
  if (!u) return null;
  return UNIT_ALIASES[u] ?? u;
}

export function normalizeKey(name: string, unit: string | null): string {
  return `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
}

/**
 * Aggregate ingredients across plan entries. Items with the same name and a
 * compatible unit are summed (qty × servings) — so "500 g" and "0.5 kg" of
 * flour become one "1 kg" line. Unquantified entries are flagged so the UI can
 * show "+" rather than a wrong total.
 */
export function aggregateIngredients(
  entries: EntryForShopping[],
): ShoppingItem[] {
  type Acc = {
    key: string;
    name: string;
    /** Distinct canonical units seen, so a lone "3 tbsp" stays in tbsp. */
    units: Set<string>;
    /** Family base unit, when every quantified unit converts. */
    base: "g" | "ml" | null;
    /** Total in the base unit (convertible) or in the single raw unit. */
    total: number | null;
    hasUnquantified: boolean;
    rawUnit: string | null;
    sources: Map<string, number>;
  };
  const map = new Map<string, Acc>();

  for (const entry of entries) {
    for (const ing of entry.meal.ingredients) {
      const name = ing.name.trim();
      if (!name) continue;
      const unit = canonicalUnit(ing.unit);
      const conv = unit ? UNIT_FACTORS[unit] : undefined;
      // Keyed by the family base (g/ml) when convertible, so mixed units meet.
      // That also keeps old shopping-check keys ("flour|g") working.
      const key = normalizeKey(name, conv ? conv.base : unit);
      const scaled = ing.qty != null ? ing.qty * entry.servings : null;
      const inBase = scaled != null && conv ? scaled * conv.factor : scaled;

      let acc = map.get(key);
      if (!acc) {
        acc = {
          key,
          name,
          units: new Set(),
          base: conv?.base ?? null,
          total: null,
          hasUnquantified: false,
          rawUnit: unit,
          sources: new Map(),
        };
        map.set(key, acc);
      }
      if (entry.source) {
        acc.sources.set(entry.source, (acc.sources.get(entry.source) ?? 0) + (entry.sourceCount ?? entry.servings));
      }
      if (inBase == null) {
        acc.hasUnquantified = true;
      } else {
        acc.total = (acc.total ?? 0) + inBase;
        if (unit) acc.units.add(unit);
      }
    }
  }

  return [...map.values()]
    .map((acc): ShoppingItem => {
      let unit = acc.rawUnit;
      let totalQty = acc.total;
      if (acc.base && totalQty != null) {
        if (acc.units.size === 1) {
          // One unit throughout: show it as written ("3 tbsp", not "45 ml").
          unit = [...acc.units][0];
          totalQty = totalQty / UNIT_FACTORS[unit].factor;
        } else {
          ({ qty: totalQty, unit } = bestMetric(totalQty, acc.base));
        }
      }
      return {
        key: acc.key,
        name: acc.name,
        unit,
        totalQty,
        hasUnquantified: acc.hasUnquantified,
        sources: [...acc.sources].map(([label, count]) => ({ label, count })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Express a base-unit total in the friendliest metric unit (1500 g → 1.5 kg). */
function bestMetric(qty: number, base: "g" | "ml"): { qty: number; unit: string } {
  if (qty >= 1000) return { qty: qty / 1000, unit: base === "g" ? "kg" : "l" };
  return { qty, unit: base };
}

export function formatShoppingAmount(item: ShoppingItem): string {
  if (item.totalQty == null) return "";
  const base = formatQtyUnit(item.totalQty, item.unit);
  return item.hasUnquantified ? `${base} +` : base;
}
