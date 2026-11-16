"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimal } from "@/lib/utils";
import type { MealMacros } from "@/lib/macros";
import type { ManualProductInput } from "@/lib/schemas";
import type { Portion } from "@/lib/products";

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
  /** Named portions ("slice" = "25"). Half-filled rows are dropped on save. */
  portions: { label: string; grams: string }[];
};

export const EMPTY_DRAFT: ProductDraft = {
  name: "",
  brand: "",
  servingGrams: "",
  macros: {},
  portions: [],
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
    portions: draft.portions.flatMap((p) => {
      const label = p.label.trim().replace(/^1s+/, "");
      const grams = num(p.grams);
      return label && grams != null && grams > 0 ? [{ label, grams }] : [];
    }),
  };
}

export function draftFrom(p: {
  name: string;
  brand: string | null;
  servingGrams: number | null;
  per100g: MealMacros;
  portions?: Portion[];
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
    portions: (p.portions ?? []).map((x) => ({ label: x.label, grams: String(x.grams) })),
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

      <PortionEditor
        portions={draft.portions}
        onChange={(portions) => set({ portions })}
      />
    </div>
  );
}

/**
 * Extra named portions — "slice", "scoop", "cup" — each with its weight, so
 * logging is a tap instead of a weighing.
 */
function PortionEditor({
  portions,
  onChange,
}: {
  portions: ProductDraft["portions"];
  onChange: (next: ProductDraft["portions"]) => void;
}) {
  const update = (i: number, patch: Partial<ProductDraft["portions"][number]>) =>
    onChange(portions.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Portions (optional)</p>
        <p className="text-xs text-muted-foreground">
          E.g. 1 slice = 25 g, 1 scoop = 30 g — shown as one-tap buttons when logging.
        </p>
      </div>
      {portions.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">1</span>
          <Input
            value={p.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="slice"
            aria-label="Portion name"
            className="min-w-0 flex-1"
            autoComplete="off"
          />
          <span className="text-sm text-muted-foreground">=</span>
          <Input
            value={p.grams}
            onChange={(e) => update(i, { grams: e.target.value })}
            inputMode="decimal"
            placeholder="25"
            aria-label="Grams"
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">g</span>
          <button
            type="button"
            onClick={() => onChange(portions.filter((_, j) => j !== i))}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
            aria-label="Remove portion"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {portions.length < 20 && (
        <button
          type="button"
          onClick={() => onChange([...portions, { label: "", grams: "" }])}
          className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 text-xs font-medium text-primary active:bg-muted"
        >
          <Plus className="size-3.5" /> Add portion
        </button>
      )}
    </div>
  );
}
