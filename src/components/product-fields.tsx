"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimal } from "@/lib/utils";
import type { MealMacros } from "@/lib/macros";
import type { ManualProductInput } from "@/lib/schemas";

const MACRO_FIELDS: { key: keyof MealMacros; label: string }[] = [
  { key: "kcal", label: "kcal" },
  { key: "protein", label: "Protein g" },
  { key: "fat", label: "Fat g" },
  { key: "carbs", label: "Carbs g" },
  { key: "sugar", label: "Sugar g" },
  { key: "fiber", label: "Fiber g" },
];

/**
 * A product being typed in. Everything is a string while editing — a half-typed
 * "1." is not a number yet, and coercing on every keystroke fights the user.
 */
export type ProductDraft = {
  name: string;
  brand: string;
  servingGrams: string;
  macros: Record<string, string>;
};

export const EMPTY_DRAFT: ProductDraft = {
  name: "",
  brand: "",
  servingGrams: "",
  macros: {},
};

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = parseDecimal(v);
  return Number.isFinite(n) ? n : null;
}

export function draftMacros(draft: ProductDraft): MealMacros {
  return {
    kcal: num(draft.macros.kcal),
    protein: num(draft.macros.protein),
    fat: num(draft.macros.fat),
    carbs: num(draft.macros.carbs),
    sugar: num(draft.macros.sugar),
    fiber: num(draft.macros.fiber),
  };
}

/**
 * Shape a draft into the payload the create/update actions validate. Returns the
 * parsed shape (real numbers), not the raw one — callers reuse these values to
 * render the product straight back without a refetch.
 */
export function draftToInput(draft: ProductDraft): ManualProductInput {
  const sg = num(draft.servingGrams);
  return {
    name: draft.name.trim(),
    brand: draft.brand.trim() || null,
    servingLabel: sg != null ? `${sg} g` : null,
    servingGrams: sg != null && sg > 0 ? sg : null,
    ...draftMacros(draft),
  };
}

export function draftFrom(p: {
  name: string;
  brand: string | null;
  servingGrams: number | null;
  per100g: MealMacros;
}): ProductDraft {
  const s = (v: number | null) => (v == null ? "" : String(v));
  return {
    name: p.name,
    brand: p.brand ?? "",
    servingGrams: s(p.servingGrams),
    macros: {
      kcal: s(p.per100g.kcal),
      protein: s(p.per100g.protein),
      fat: s(p.per100g.fat),
      carbs: s(p.per100g.carbs),
      sugar: s(p.per100g.sugar),
      fiber: s(p.per100g.fiber),
    },
  };
}

/**
 * The name/brand/macro inputs shared by "add a product" on /track and "edit" on
 * /products. Macros are per 100 g/ml everywhere in the app — that's the only
 * basis the scaling maths understands.
 */
export function ProductFields({
  draft,
  onChange,
}: {
  draft: ProductDraft;
  onChange: (next: ProductDraft) => void;
}) {
  const set = (patch: Partial<ProductDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-name">Name</Label>
        <Input
          id="product-name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Chicken breast, raw"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-brand">Brand or shop (optional)</Label>
        <Input
          id="product-brand"
          value={draft.brand}
          onChange={(e) => set({ brand: e.target.value })}
          placeholder="e.g. Cekin, or the butcher"
          autoComplete="off"
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Macros per 100 g / ml
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MACRO_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={draft.macros[f.key] ?? ""}
                onChange={(e) =>
                  set({ macros: { ...draft.macros, [f.key]: e.target.value } })
                }
              />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">1 serving = g</Label>
            <Input
              inputMode="decimal"
              placeholder="optional"
              value={draft.servingGrams}
              onChange={(e) => set({ servingGrams: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
