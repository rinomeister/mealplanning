"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Globe,
  Loader2,
  Package,
  Plus,
  ScanBarcode,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScanProductDialog } from "@/components/scan-product-dialog";
import { ProductPickerDialog } from "@/components/product-picker-dialog";
import { OffSearchDialog } from "@/components/off-search-dialog";
import type { PickerProduct } from "@/components/add-product-dialog";
import type { Usage } from "@/lib/usage";
import { cn, parseDecimal } from "@/lib/utils";
import {
  addMacros,
  fmtMacro,
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
  cookedGrams: string;
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

const round2 = (n: number) => Math.round(n * 100) / 100;

function num(s: string): number {
  const n = parseDecimal(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Create / edit a meal. Ingredients come only from stored products, a barcode
 * scan or an Open Food Facts search, so every one carries macros and the
 * per-serving totals (pinned at the top) are always computed. Older meals may
 * still hold typed-in ingredient rows; those are shown and kept, just not
 * counted. Hand-entered macros remain as an override, tucked away.
 */
export function MealForm({
  tags,
  products,
  productUsage,
  initial,
}: {
  tags: TagItem[];
  products: PickerProduct[];
  productUsage?: Usage;
  initial?: MealFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? "");
  const [serves, setServes] = useState(initial?.serves ?? "1");
  const [cookedGrams, setCookedGrams] = useState(initial?.cookedGrams ?? "");
  const [prepSteps, setPrepSteps] = useState(initial?.prepSteps ?? "");
  const [kcal, setKcal] = useState(initial?.kcal ?? "");
  const [protein, setProtein] = useState(initial?.protein ?? "");
  const [fat, setFat] = useState(initial?.fat ?? "");
  const [carbs, setCarbs] = useState(initial?.carbs ?? "");
  const [sugar, setSugar] = useState(initial?.sugar ?? "");
  const [fiber, setFiber] = useState(initial?.fiber ?? "");
  const [macrosManual, setMacrosManual] = useState(initial?.macrosManual ?? false);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    (initial?.ingredients ?? []).filter((r) => r.name.trim() !== ""),
  );
  const [dialog, setDialog] = useState<null | "scan" | "picker" | "search">(null);
  const closeDialog = () => setDialog(null);

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
  function removeRow(i: number) {
    setIngredients((rows) => rows.filter((_, idx) => idx !== i));
  }
  function addRow(row: IngredientRow) {
    setIngredients((rows) => [...rows, row]);
  }
  // Products come in gram-based, defaulting to the last amount used or one
  // serving. Macro-less products still land (named) so they can be fixed later.
  function addProductRow(p: PickerProduct) {
    const withMacros = hasAnyMacro(p.per100g);
    addRow({
      name: p.name,
      qty: String(productUsage?.last[p.id]?.grams ?? p.servingGrams ?? 100),
      unit: "g",
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

  const countedRows = ingredients.filter((r) => hasAnyMacro(r.per100g));
  const hasCounted = countedRows.length > 0;
  const servesNum = (() => {
    const n = parseDecimal(serves);
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();
  const batchTotal = ingredients.reduce<Macros>((acc, r) => {
    const m = rowMacros(r);
    return m ? addMacros(acc, m) : acc;
  }, { ...ZERO_MACROS });
  const computedPerServing: Macros = {
    kcal: batchTotal.kcal / servesNum,
    protein: batchTotal.protein / servesNum,
    fat: batchTotal.fat / servesNum,
    carbs: batchTotal.carbs / servesNum,
    sugar: batchTotal.sugar / servesNum,
    fiber: batchTotal.fiber / servesNum,
  };
  // With nothing countable, the typed numbers are the only source of macros.
  const manualMode = macrosManual || !hasCounted;
  const manualMacros: Macros = {
    kcal: num(kcal),
    protein: num(protein),
    fat: num(fat),
    carbs: num(carbs),
    sugar: num(sugar),
    fiber: num(fiber),
  };
  const perServing = manualMode ? manualMacros : computedPerServing;
  const manualHasValues = [kcal, protein, fat, carbs, sugar, fiber].some(
    (v) => v.trim() !== "",
  );

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
      cookedGrams,
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

  const selectedTagNames = allTags.filter((t) => selected.has(t.id)).map((t) => t.name);
  const cookedNum = parseDecimal(cookedGrams);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Totals, pinned while scrolling */}
      <div className="sticky top-0 z-20 -mx-1">
        <div className="rounded-xl border border-border bg-card/95 p-3 shadow-md backdrop-blur">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold leading-none tabular-nums text-primary">
                {fmtMacro(perServing.kcal, "kcal")}
                <span className="ml-1 text-sm font-medium text-muted-foreground">kcal</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                per serving{servingLabel.trim() ? ` (${servingLabel.trim()})` : ""}
                {manualMode && (hasCounted || manualHasValues) ? " · entered by hand" : ""}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <MacroPill label="Protein" value={perServing.protein} />
              <MacroPill label="Carbs" value={perServing.carbs} />
              <MacroPill label="Fat" value={perServing.fat} />
            </div>
          </div>
          {hasCounted && (
            <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground tabular-nums">
              Whole batch {Math.round(batchTotal.kcal)} kcal ·{" "}
              {fmtMacro(batchTotal.protein)} g protein · {servesNum} serving
              {servesNum === 1 ? "" : "s"}
              {" · "}sugar {fmtMacro(perServing.sugar)} g · fiber{" "}
              {fmtMacro(perServing.fiber)} g /serving
            </p>
          )}
        </div>
      </div>

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
              <Label htmlFor="serves">Makes … servings</Label>
              <Input
                id="serves"
                value={serves}
                onChange={(e) => setServes(e.target.value)}
                inputMode="decimal"
                placeholder="1"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="servingLabel">One serving is…</Label>
              <Input
                id="servingLabel"
                value={servingLabel}
                onChange={(e) => setServingLabel(e.target.value)}
                placeholder="1 bowl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <Label>Ingredients</Label>
            {ingredients.length > 0 && (
              <span className="text-xs text-muted-foreground">grams in the whole recipe</span>
            )}
          </div>

          {ingredients.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
              Add ingredients from your products, by scanning, or by searching online.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {ingredients.map((row, i) => {
                const contribution = rowMacros(row);
                const legacy = !row.per100g;
                return (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {row.barcode ? (
                          <ScanBarcode className="size-3 shrink-0" />
                        ) : (
                          <Package className="size-3 shrink-0" />
                        )}
                        {legacy ? (
                          <span className="text-amber-600">
                            {row.qty || row.unit
                              ? `${row.qty} ${row.unit} · `
                              : ""}
                            no macros, not counted
                          </span>
                        ) : contribution ? (
                          <span className="tabular-nums">
                            {Math.round(contribution.kcal)} kcal · {fmtMacro(contribution.protein)} g P
                          </span>
                        ) : (
                          "enter grams to count it"
                        )}
                      </p>
                    </div>
                    {!legacy && (
                      <div className="flex items-center gap-1">
                        <Input
                          aria-label={`Grams of ${row.name}`}
                          value={row.qty}
                          onChange={(e) => updateRow(i, { qty: e.target.value })}
                          inputMode="decimal"
                          placeholder="0"
                          className="h-9 w-20 text-right tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground">g</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label={`Remove ${row.name}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid grid-cols-3 gap-2">
            <AddButton icon={<Package className="size-5" />} label="My products" onClick={() => setDialog("picker")} />
            <AddButton icon={<ScanBarcode className="size-5" />} label="Scan" onClick={() => setDialog("scan")} />
            <AddButton icon={<Globe className="size-5" />} label="Search online" onClick={() => setDialog("search")} />
          </div>
        </CardContent>
      </Card>

      {/* Less-used options */}
      <Card className="divide-y divide-border">
        <Section
          title="Batch weight"
          summary={
            Number.isFinite(cookedNum) && cookedNum > 0
              ? `${cookedGrams} g cooked`
              : "optional"
          }
          defaultOpen={Number.isFinite(cookedNum) && cookedNum > 0}
        >
          <div className="flex items-center gap-2">
            <Input
              id="cookedGrams"
              aria-label="Whole batch weight, cooked"
              value={cookedGrams}
              onChange={(e) => setCookedGrams(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 1200"
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">g cooked</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {Number.isFinite(cookedNum) && cookedNum > 0
              ? `About ${Math.round(cookedNum / servesNum)} g per serving. You'll log it by the grams on your plate.`
              : "Weigh the pot once it's cooked to log this meal by the grams on your plate."}
          </p>
        </Section>

        <Section
          title="Enter macros by hand"
          summary={manualMode && (hasCounted || manualHasValues) ? "on" : "off"}
          defaultOpen={initial?.macrosManual ?? false}
        >
          {hasCounted ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={macrosManual}
                onChange={(e) => setMacrosManual(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Override the totals from ingredients
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Used while the meal has no ingredients with macros, e.g. a restaurant dish.
            </p>
          )}
          {manualMode && (
            <div className="grid grid-cols-3 gap-2">
              <MacroInput label="kcal" value={kcal} onChange={setKcal} />
              <MacroInput label="Protein g" value={protein} onChange={setProtein} />
              <MacroInput label="Carbs g" value={carbs} onChange={setCarbs} />
              <MacroInput label="Fat g" value={fat} onChange={setFat} />
              <MacroInput label="Sugar g" value={sugar} onChange={setSugar} />
              <MacroInput label="Fiber g" value={fiber} onChange={setFiber} />
            </div>
          )}
          {manualMode && <p className="text-xs text-muted-foreground">Per serving.</p>}
        </Section>

        <Section
          title="Tags"
          summary={selectedTagNames.length ? selectedTagNames.join(", ") : "none"}
        >
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
              Add
            </Button>
          </div>
        </Section>

        <Section
          title="Preparation"
          summary={prepSteps.trim() ? "written" : "optional"}
        >
          <Textarea
            id="prepSteps"
            aria-label="Preparation"
            value={prepSteps}
            onChange={(e) => setPrepSteps(e.target.value)}
            placeholder={"Step 1: …\nStep 2: …"}
            rows={5}
          />
        </Section>
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

      {dialog === "scan" && (
        <ScanProductDialog
          title="Scan an ingredient"
          confirmLabel="Add ingredient"
          gramsLabel="How many grams in the recipe?"
          onConfirm={(p, grams) => {
            addRow({
              name: p.name,
              qty: String(grams),
              unit: "g",
              note: "",
              barcode: p.barcode,
              per100g: hasAnyMacro(p.per100g) ? p.per100g : null,
            });
            return true;
          }}
          onClose={closeDialog}
        />
      )}

      {dialog === "picker" && (
        <ProductPickerDialog
          products={products}
          usage={productUsage}
          onPick={addProductRow}
          onClose={closeDialog}
        />
      )}

      {dialog === "search" && (
        <OffSearchDialog
          title="Search ingredients online"
          onPick={addProductRow}
          onClose={closeDialog}
        />
      )}
    </form>
  );
}

function MacroPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-14 rounded-lg bg-muted/70 px-2 py-1">
      <p className="text-sm font-semibold leading-tight tabular-nums">
        {fmtMacro(value)}
        <span className="text-xs font-normal">g</span>
      </p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function AddButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-xs font-medium hover:bg-muted active:bg-muted"
    >
      {icon}
      {label}
    </button>
  );
}

/** A collapsible row inside the "more options" card. */
function Section({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium">{title}</span>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
          {summary}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">{children}</div>
    </details>
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
    <div className="flex flex-col gap-1">
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
