"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, Plus, ScanBarcode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MacroSummary } from "@/components/macro-summary";
import { ScanProductDialog } from "@/components/scan-product-dialog";
import { ProductPickerDialog } from "@/components/product-picker-dialog";
import type { PickerProduct } from "@/components/add-product-dialog";
import { cn, parseDecimal } from "@/lib/utils";
import {
  addMacros,
  scaleGrams,
  ZERO_MACROS,
  type Macros,
  type MealMacros,
} from "@/lib/macros";
import { TAG_COLORS } from "@/lib/default-tags";
import {
  createMealAction,
  createTagAction,
  updateMealAction,
} from "@/app/(app)/meals/actions";

type TagItem = { id: string; name: string; color: string | null };
export type IngredientRow = {
  name: string;
  qty: string;
  unit: string;
  note: string;
  /** Set when scanned from a barcode; macros are per 100 g/ml, qty is grams. */
  barcode: string | null;
  per100g: MealMacros | null;
};

export type MealFormInitial = {
  id: string;
  name: string;
  prepSteps: string;
  servingLabel: string;
  serves: string;
  macrosManual: boolean;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
  sugar: string;
  fiber: string;
  ingredients: IngredientRow[];
  tagIds: string[];
};

const emptyRow: IngredientRow = {
  name: "",
  qty: "",
  unit: "",
  note: "",
  barcode: null,
  per100g: null,
};

function hasAnyMacro(m: MealMacros | null): boolean {
  return (
    !!m &&
    (m.kcal != null ||
      m.protein != null ||
      m.fat != null ||
      m.carbs != null ||
      m.sugar != null ||
      m.fiber != null)
  );
}

function isEmptyRow(r: IngredientRow): boolean {
  return (
    r.name.trim() === "" &&
    r.qty.trim() === "" &&
    r.unit.trim() === "" &&
    r.note.trim() === "" &&
    !r.per100g
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function MealForm({
  tags,
  products,
  initial,
}: {
  tags: TagItem[];
  products: PickerProduct[];
  initial?: MealFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? "");
  const [serves, setServes] = useState(initial?.serves ?? "1");
  const [prepSteps, setPrepSteps] = useState(initial?.prepSteps ?? "");
  const [kcal, setKcal] = useState(initial?.kcal ?? "");
  const [protein, setProtein] = useState(initial?.protein ?? "");
  const [fat, setFat] = useState(initial?.fat ?? "");
  const [carbs, setCarbs] = useState(initial?.carbs ?? "");
  const [sugar, setSugar] = useState(initial?.sugar ?? "");
  const [fiber, setFiber] = useState(initial?.fiber ?? "");
  const [macrosManual, setMacrosManual] = useState(initial?.macrosManual ?? false);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ ...emptyRow }],
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [allTags, setAllTags] = useState<TagItem[]>(tags);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial?.tagIds ?? []),
  );
  const [newTag, setNewTag] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  function updateRow(i: number, patch: Partial<IngredientRow>) {
    setIngredients((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }
  function addRow() {
    setIngredients((rows) => [...rows, { ...emptyRow }]);
  }
  function removeRow(i: number) {
    setIngredients((rows) =>
      rows.length === 1 ? [{ ...emptyRow }] : rows.filter((_, idx) => idx !== i),
    );
  }
  function addScannedRow(row: IngredientRow) {
    setIngredients((rows) =>
      rows.length === 1 && isEmptyRow(rows[0]) ? [row] : [...rows, row],
    );
  }
  // Drop a product from the library in as an editable ingredient row. Products
  // with macros come in gram-based (defaulting to one serving) so they count
  // straight away; macro-less ones land as a plain named row.
  function addProductRow(p: PickerProduct) {
    const withMacros = hasAnyMacro(p.per100g);
    addScannedRow({
      name: p.name,
      qty: withMacros ? String(p.servingGrams ?? 100) : "",
      unit: withMacros ? "g" : "",
      note: "",
      barcode: p.barcode,
      per100g: withMacros ? p.per100g : null,
    });
  }

  function toggleTag(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateTag() {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    setCreatingTag(true);
    const color = TAG_COLORS[allTags.length % TAG_COLORS.length];
    const res = await createTagAction(trimmed, color);
    setCreatingTag(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setAllTags((prev) =>
      prev.some((t) => t.id === res.id) ? prev : [...prev, res],
    );
    setSelected((prev) => new Set(prev).add(res.id));
    setNewTag("");
  }

  // Contribution of one ingredient (per-100g macros × grams/100), or null.
  function rowMacros(r: IngredientRow): Macros | null {
    if (!hasAnyMacro(r.per100g)) return null;
    const g = parseDecimal(r.qty);
    if (!Number.isFinite(g) || g <= 0) return null;
    return scaleGrams(r.per100g as MealMacros, g);
  }

  const scannedRows = ingredients.filter((r) => hasAnyMacro(r.per100g));
  const hasScanned = scannedRows.length > 0;
  const servesNum = (() => {
    const n = parseDecimal(serves);
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();
  const scannedTotal = ingredients.reduce<Macros>((acc, r) => {
    const m = rowMacros(r);
    return m ? addMacros(acc, m) : acc;
  }, { ...ZERO_MACROS });
  const computedPerServing: Macros = {
    kcal: scannedTotal.kcal / servesNum,
    protein: scannedTotal.protein / servesNum,
    fat: scannedTotal.fat / servesNum,
    carbs: scannedTotal.carbs / servesNum,
    sugar: scannedTotal.sugar / servesNum,
    fiber: scannedTotal.fiber / servesNum,
  };
  const manualMode = macrosManual || !hasScanned;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanIngredients = ingredients
      .map((r) => ({
        name: r.name.trim(),
        qty: r.qty,
        unit: r.unit.trim(),
        note: r.note.trim(),
        barcode: r.barcode,
        kcal: r.per100g?.kcal ?? null,
        protein: r.per100g?.protein ?? null,
        fat: r.per100g?.fat ?? null,
        carbs: r.per100g?.carbs ?? null,
        sugar: r.per100g?.sugar ?? null,
        fiber: r.per100g?.fiber ?? null,
      }))
      .filter((r) => r.name.length > 0);

    const macros = manualMode
      ? { kcal, protein, fat, carbs, sugar, fiber }
      : {
          kcal: round2(computedPerServing.kcal),
          protein: round2(computedPerServing.protein),
          fat: round2(computedPerServing.fat),
          carbs: round2(computedPerServing.carbs),
          sugar: round2(computedPerServing.sugar),
          fiber: round2(computedPerServing.fiber),
        };

    const payload = {
      name: name.trim(),
      servingLabel,
      prepSteps,
      serves,
      macrosManual: manualMode,
      ...macros,
      ingredients: cleanIngredients,
      tagIds: Array.from(selected),
    };

    if (!payload.name) {
      setError("Meal name is required.");
      return;
    }

    startTransition(async () => {
      const res = initial
        ? await updateMealAction(initial.id, payload)
        : await createMealAction(payload);
      // On success the action redirects; we only reach here on failure.
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Meal name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Overnight oats"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="servingLabel">One serving is…</Label>
              <Input
                id="servingLabel"
                value={servingLabel}
                onChange={(e) => setServingLabel(e.target.value)}
                placeholder="1 bowl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serves">Makes … servings</Label>
              <Input
                id="serves"
                value={serves}
                onChange={(e) => setServes(e.target.value)}
                inputMode="decimal"
                placeholder="1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>Ingredients</Label>
            <span className="text-xs text-muted-foreground">
              qty &amp; unit optional
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {ingredients.map((row, i) => {
              const contribution = rowMacros(row);
              return (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-2">
                  <div className="flex gap-2">
                    <Input
                      aria-label="Quantity"
                      value={row.qty}
                      onChange={(e) => updateRow(i, { qty: e.target.value })}
                      placeholder="500"
                      inputMode="decimal"
                      className="w-20"
                    />
                    <Input
                      aria-label="Unit"
                      value={row.unit}
                      onChange={(e) => updateRow(i, { unit: e.target.value })}
                      placeholder="ml"
                      className="w-20"
                    />
                    <Input
                      aria-label="Ingredient name"
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      placeholder="milk"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(i)}
                      aria-label="Remove ingredient"
                    >
                      <X />
                    </Button>
                  </div>
                  {row.per100g ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {row.barcode ? (
                        <ScanBarcode className="size-3" />
                      ) : (
                        <Package className="size-3" />
                      )}
                      {row.barcode ? "Scanned" : "From products"}
                      {contribution
                        ? ` · ${Math.round(contribution.kcal)} kcal`
                        : " · set a gram amount to count it"}
                    </p>
                  ) : (
                    <Input
                      aria-label="Note"
                      value={row.note}
                      onChange={(e) => updateRow(i, { note: e.target.value })}
                      placeholder="note (optional, e.g. semi-skimmed)"
                      className="text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus /> Add ingredient
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Package /> From products
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScanOpen(true)}
            >
              <ScanBarcode /> Scan ingredient
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Nutrition */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Label>Macros per serving</Label>

          {hasScanned && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={macrosManual}
                onChange={(e) => setMacrosManual(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Enter macros manually instead of from scanned ingredients
            </label>
          )}

          {manualMode ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MacroInput label="kcal" value={kcal} onChange={setKcal} />
              <MacroInput label="Protein (g)" value={protein} onChange={setProtein} />
              <MacroInput label="Fat (g)" value={fat} onChange={setFat} />
              <MacroInput label="Carbs (g)" value={carbs} onChange={setCarbs} />
              <MacroInput label="Sugar (g)" value={sugar} onChange={setSugar} />
              <MacroInput label="Fiber (g)" value={fiber} onChange={setFiber} />
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                Calculated from {scannedRows.length} scanned ingredient
                {scannedRows.length === 1 ? "" : "s"} ÷ {servesNum} serving
                {servesNum === 1 ? "" : "s"}
              </p>
              <MacroSummary macros={computedPerServing} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {allTags.length === 0 && (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            )}
            {allTags.map((tag) => {
              const isOn = selected.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    isOn
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                  style={isOn ? { backgroundColor: tag.color ?? "#16a34a" } : undefined}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreateTag();
                }
              }}
              placeholder="New tag name"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCreateTag()}
              disabled={creatingTag || !newTag.trim()}
            >
              {creatingTag ? <Loader2 className="animate-spin" /> : <Plus />}
              Add tag
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prep steps */}
      <Card>
        <CardContent className="flex flex-col gap-1.5">
          <Label htmlFor="prepSteps">Preparation (optional)</Label>
          <Textarea
            id="prepSteps"
            value={prepSteps}
            onChange={(e) => setPrepSteps(e.target.value)}
            placeholder={"Step 1: …\nStep 2: …"}
            rows={5}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending && <Loader2 className="animate-spin" />}
          {initial ? "Save changes" : "Create meal"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>

      {scanOpen && (
        <ScanProductDialog
          title="Scan an ingredient"
          confirmLabel="Add ingredient"
          gramsLabel="How many grams in the recipe?"
          onConfirm={(p, grams) => {
            addScannedRow({
              name: p.name,
              qty: String(grams),
              unit: "g",
              note: "",
              barcode: p.barcode,
              per100g: p.per100g,
            });
            return true;
          }}
          onClose={() => setScanOpen(false)}
        />
      )}

      {pickerOpen && (
        <ProductPickerDialog
          products={products}
          onPick={addProductRow}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </form>
  );
}

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0"
      />
    </div>
  );
}
