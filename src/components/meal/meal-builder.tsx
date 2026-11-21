"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, GripVertical, Loader2, Plus, ScanBarcode, Search, Tag, X } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { addMacros, isServingUnit, scaleGrams, scaleMacros, ZERO_MACROS, type Macros, type MealMacros } from "@/lib/macros";
import { MACROS_UI, fmtG, fmtKcal, type Targets } from "@/lib/macro-format";
import type { PickerProduct, Portion } from "@/lib/products";
import type { Usage } from "@/lib/usage";
import { TAG_TINTS, tagStyle, type TagTint } from "@/lib/tag-colors";
import { MacroBar } from "@/components/macro-ui";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { Sheet } from "@/components/ui/sheet";
import { FlowScreen } from "@/components/add/flow-screen";
import { ScanProductDialog } from "@/components/scan-product-dialog";
import { ProductPickerDialog } from "@/components/product-picker-dialog";
import { createMealAction, createTagAction, updateMealAction } from "@/app/(app)/meals/actions";
import { importOffProductAction } from "@/app/(app)/products/actions";
import { useSaveShortcut } from "@/lib/use-save-shortcut";

type TagItem = { id: string; name: string; color: string | null };

export type IngredientRow = {
  name: string;
  qty: string;
  unit: string;
  note: string;
  /** Set when scanned from a barcode. */
  barcode: string | null;
  /** Per 100 g/ml when qty is grams; per serving when the unit is "serving"
   * (a meal or quick add folded in by "Save as meal"). */
  per100g: MealMacros | null;
  /** The product's portions, for the amount chips (not saved). */
  portions?: Portion[];
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

const MANUAL_KEYS = ["kcal", "protein", "carbs", "fat", "sugar", "fiber"] as const;
type ManualKey = (typeof MANUAL_KEYS)[number];

const field =
  "h-[52px] w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-surface pl-3.5 text-[17px] font-medium outline-none focus:border-2 focus:border-ink";
const labelCls = "text-[13px] font-semibold text-ink-2";
const round2 = (n: number) => Math.round(n * 100) / 100;

function hasAnyMacro(m: MealMacros | null | undefined): m is MealMacros {
  return !!m && Object.values(m).some((v) => v != null);
}
function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = parseDecimal(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const isServingRow = (r: IngredientRow) => isServingUnit(r.unit);
function rowMacros(r: IngredientRow): Macros | null {
  if (!hasAnyMacro(r.per100g)) return null;
  const q = num(r.qty);
  if (!q || q <= 0) return null;
  return isServingRow(r) ? scaleMacros(r.per100g, q) : scaleGrams(r.per100g, q);
}
function sumRows(rows: IngredientRow[]): Macros {
  return rows.reduce<Macros>((acc, r) => {
    const m = rowMacros(r);
    return m ? addMacros(acc, m) : acc;
  }, { ...ZERO_MACROS });
}
/**
 * A saved "entered by hand" flag that is really just the ingredient totals
 * (every row counted, numbers match): older saves set it whenever a meal had
 * no countable rows yet, and "Save as meal" always did. Treat those as "From
 * ingredients", or the totals never move when ingredients change.
 */
function staleManual(initial: MealFormInitial, rows: IngredientRow[]): boolean {
  if (rows.length === 0 || !rows.every((r) => rowMacros(r))) return false;
  const serves = num(initial.serves) || 1;
  const batch = sumRows(rows);
  return MANUAL_KEYS.every((k) => {
    const stored = num(initial[k]) ?? 0;
    const computed = batch[k] / serves;
    return Math.abs(stored - computed) <= (k === "kcal" ? 1.5 : 0.6);
  });
}
/** "1 bowl" → "bowl". */
function servingNoun(label: string): string {
  return label.trim().replace(/^1\s+/, "") || "serving";
}
function splitSteps(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.replace(/^\s*(step\s*)?\d+[.):]\s*/i, "").trim())
    .filter(Boolean);
}

let stepSeq = 0;
const stepId = () => `s${++stepSeq}`;

/** A collapsible card section. */
function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-14 w-full items-center gap-2 px-4 text-left">
        <span className="t-h3 flex-1">{title}</span>
        <ChevronDown className={cn("size-5 text-ink-2 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-3.5 px-4 pb-4">{children}</div>}
    </section>
  );
}

/**
 * Meal builder (/meals/new, /meals/:id/edit). Ingredients come from products
 * (picked or scanned), so totals are computed; tap an amount to edit it in
 * place. Servings & weighing, macros mode, prep steps and tags fold away.
 */
export function MealBuilder({
  tags,
  products,
  productUsage,
  targets,
  initial,
}: {
  tags: TagItem[];
  products: PickerProduct[];
  productUsage?: Usage;
  targets: Targets;
  initial?: MealFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? "");
  const [serves, setServes] = useState(initial?.serves ?? "1");
  const [cookedGrams, setCookedGrams] = useState(initial?.cookedGrams ?? "");
  const [steps, setSteps] = useState(() => splitSteps(initial?.prepSteps ?? "").map((text) => ({ id: stepId(), text })));
  const [manual, setManual] = useState<Record<ManualKey, string>>({
    kcal: initial?.kcal ?? "",
    protein: initial?.protein ?? "",
    carbs: initial?.carbs ?? "",
    fat: initial?.fat ?? "",
    sugar: initial?.sugar ?? "",
    fiber: initial?.fiber ?? "",
  });
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    (initial?.ingredients ?? [])
      .filter((r) => r.name.trim() !== "")
      .map((r) => {
        const byCode = r.barcode ? products.find((x) => x.barcode === r.barcode) : undefined;
        const p = byCode ?? products.find((x) => x.name === r.name);
        const row = { ...r, portions: p ? productPortions(p) : [] };
        // Repair rows saved by the old scan bug ("Unnamed product", no macros)
        // from the product that was actually saved under that barcode.
        if (byCode && !hasAnyMacro(r.per100g) && hasAnyMacro(byCode.per100g)) {
          row.per100g = byCode.per100g;
          if (r.name === "Unnamed product") row.name = byCode.name;
        }
        return row;
      }),
  );
  // Only an explicit, still-meaningful "entered by hand" survives loading.
  const [macrosManual, setMacrosManual] = useState(
    () => !!initial?.macrosManual && ingredients.some((r) => rowMacros(r)) && !staleManual(initial, ingredients),
  );
  const [editRow, setEditRow] = useState<number | null>(null);
  const [view, setView] = useState<"serving" | "pot">("serving");
  const [open, setOpen] = useState({ servings: !initial, macros: false, steps: false });
  const [dialog, setDialog] = useState<null | "scan" | "picker" | "tags">(null);
  const [allTags, setAllTags] = useState<TagItem[]>(tags);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.tagIds ?? []));
  const [focusStep, setFocusStep] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const dragId = useRef<string | null>(null);

  // Adding or removing an ingredient means the totals should follow the
  // ingredients again; keeping hand-entered numbers would silently ignore it.
  function setRows(next: IngredientRow[]) {
    setIngredients(next);
    if (macrosManual && next.length > 0 && next.every((r) => rowMacros(r))) setMacrosManual(false);
  }
  const appendRow = (row: IngredientRow) => setRows([...ingredients, row]);

  useEffect(() => {
    if (!focusStep) return;
    document.querySelector<HTMLTextAreaElement>(`[data-step-input="${focusStep}"]`)?.focus();
  }, [focusStep]);

  function productPortions(p: PickerProduct): Portion[] {
    return [...(p.servingGrams ? [{ label: "serving", grams: p.servingGrams }] : []), ...p.portions];
  }

  function addProductRow(p: PickerProduct, grams?: number) {
    appendRow({
      name: p.name,
      qty: String(grams ?? productUsage?.last[p.id]?.grams ?? p.servingGrams ?? 100),
      unit: "g",
      note: "",
      barcode: p.barcode,
      per100g: hasAnyMacro(p.per100g) ? p.per100g : null,
      portions: productPortions(p),
    });
  }
  const updateRow = (i: number, patch: Partial<IngredientRow>) =>
    setIngredients((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // ---- totals
  const servesNum = num(serves) && num(serves)! > 0 ? num(serves)! : 1;
  const batch = sumRows(ingredients);
  const hasCounted = ingredients.some((r) => hasAnyMacro(r.per100g));
  const manualMode = macrosManual || !hasCounted;
  const perServing: Macros = manualMode
    ? (Object.fromEntries(MANUAL_KEYS.map((k) => [k, num(manual[k]) ?? 0])) as Macros)
    : (Object.fromEntries(MANUAL_KEYS.map((k) => [k, batch[k] / servesNum])) as Macros);
  const shown = view === "pot" ? (Object.fromEntries(MANUAL_KEYS.map((k) => [k, perServing[k] * servesNum])) as Macros) : perServing;
  const mult = view === "pot" ? servesNum : 1;
  const cooked = num(cookedGrams);
  const servingGrams = cooked && cooked > 0 ? cooked / servesNum : null;
  const noun = servingNoun(servingLabel);

  function toggleTag(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- prep steps: Enter adds the next one; drag the handle to reorder.
  function addStepAfter(i: number) {
    const id = stepId();
    setSteps((s) => [...s.slice(0, i + 1), { id, text: "" }, ...s.slice(i + 1)]);
    setFocusStep(id);
  }
  function onDragMove(e: React.PointerEvent) {
    const from = dragId.current;
    if (!from || !listRef.current) return;
    const items = Array.from(listRef.current.querySelectorAll<HTMLElement>("[data-step]"));
    let to = items.length - 1;
    for (let j = 0; j < items.length; j++) {
      const r = items[j].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        to = j;
        break;
      }
    }
    setSteps((s) => {
      const fromIdx = s.findIndex((x) => x.id === from);
      if (fromIdx === to || fromIdx < 0) return s;
      const next = [...s];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  useSaveShortcut(() => {
    if (!isPending) save();
  });

  function save() {
    setError(null);
    if (!name.trim()) {
      setError("Give the meal a name.");
      return;
    }
    const macros = manualMode
      ? manual
      : Object.fromEntries(MANUAL_KEYS.map((k) => [k, round2(perServing[k])]));
    const payload = {
      name: name.trim(),
      servingLabel,
      prepSteps: steps
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join("\n"),
      serves,
      cookedGrams,
      macrosManual: manualMode,
      ...macros,
      ingredients: ingredients.map((r) => ({
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
      })),
      tagIds: Array.from(selected),
    };
    startTransition(async () => {
      const res = initial ? await updateMealAction(initial.id, payload) : await createMealAction(payload);
      // On success the action redirects; we only get here on failure.
      if (res && !res.ok) setError(res.error);
    });
  }

  const selectedTags = allTags.filter((t) => selected.has(t.id));

  return (
    <FlowScreen
      top={
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3">
          <button type="button" onClick={() => router.back()} className="-ml-1 h-11 px-1 font-semibold">
            Cancel
          </button>
          <h1 className="truncate text-center font-semibold">{initial ? name || "Edit meal" : "New meal"}</h1>
          <button type="button" onClick={save} disabled={isPending} className="-mr-1 h-11 px-1 font-semibold">
            {isPending ? <Loader2 className="size-5 animate-spin" /> : "Save"}
          </button>
        </div>
      }
      bottom={
        <Button type="button" size="lg" className="w-full" disabled={isPending} onClick={save}>
          {isPending && <Loader2 className="animate-spin" />} Save meal
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-8">
        {/* Totals, pinned while scrolling */}
        <div className="sticky top-0 z-10 -mx-1 bg-bg px-1 pb-1 pt-0.5">
          <div className="card p-3.5">
            <div className="flex items-center gap-3">
              <div className="seg" role="radiogroup" aria-label="Show totals">
                <button type="button" role="radio" aria-checked={view === "serving"} className={cn(view === "serving" && "on")} onClick={() => setView("serving")}>
                  Per {noun}
                </button>
                <button type="button" role="radio" aria-checked={view === "pot"} className={cn(view === "pot" && "on")} onClick={() => setView("pot")}>
                  Whole pot
                </button>
              </div>
              <p className="ml-auto text-right">
                <span className="num text-[28px] font-semibold leading-none">{fmtKcal(shown.kcal)}</span>
                <span className="ml-1 text-sm text-ink-3">kcal</span>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {MACROS_UI.map((m) => (
                <div key={m.key} className="min-w-0">
                  <p className="mb-0.5 truncate text-[11px] font-semibold leading-tight text-ink-2">{m.label}</p>
                  <p className="mb-1 truncate text-[12px] font-semibold leading-none">
                    <span className="num">
                      {fmtG(shown[m.key])}
                      {m.key === "protein" ? " g" : ""}
                    </span>
                  </p>
                  <MacroBar
                    macro={m.key}
                    eaten={shown[m.key]}
                    target={targets[m.key] != null ? targets[m.key]! * mult : null}
                    size="sm"
                  />
                </div>
              ))}
            </div>
            {manualMode && hasCounted ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="flex-1 text-xs text-ink-3">Entered by hand, so ingredient changes don&apos;t change these.</p>
                <button type="button" className="chip sm shrink-0" onClick={() => setMacrosManual(false)}>
                  Use ingredient totals
                </button>
              </div>
            ) : manualMode && Object.values(manual).some((v) => v.trim()) ? (
              <p className="mt-2 text-xs text-ink-3">Macros entered by hand</p>
            ) : null}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Meal name</span>
          <input
            autoFocus={!initial}
            autoComplete="off"
            enterKeyHint="done"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chicken rice pot"
            className={field}
          />
        </label>

        {/* Ingredients */}
        <section aria-label="Ingredients" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="t-cap">Ingredients · {ingredients.length}</h2>
            {ingredients.length > 0 && <span className="text-xs text-ink-3">Tap one to edit</span>}
          </div>
          {ingredients.length === 0 ? (
            <p className="card px-4 py-5 text-center text-sm text-ink-3">
              Add ingredients from your products or by scanning. Totals add up as you go.
            </p>
          ) : (
            <ul className="card divide-y divide-line px-4">
              {ingredients.map((row, i) => {
                const m = rowMacros(row);
                const legacy = !row.per100g;
                const isEditing = editRow === i;
                const amount = `${row.qty || "–"} ${row.unit || ""}`.trim();
                return (
                  <li key={i} className="py-2.5">
                    <div className="flex min-h-11 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditRow(isEditing ? null : i)}
                        aria-expanded={isEditing}
                        aria-label={`Edit ${row.name}, ${amount}`}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{row.name}</span>
                          <span className={cn("block text-[13px]", legacy ? "text-bad" : "text-ink-3")}>
                            {legacy
                              ? "no macros, not counted"
                              : m
                                ? `${fmtKcal(m.kcal)} kcal · Protein ${fmtG(m.protein)} g`
                                : isServingRow(row) ? "enter servings to count it" : "enter grams to count it"}
                          </span>
                        </span>
                        {!isEditing && (
                          <span
                            className={cn(
                              "num flex h-10 shrink-0 items-center rounded-full border-[1.5px] border-line px-3.5 text-[15px] font-semibold",
                              legacy && "text-ink-3",
                            )}
                          >
                            {amount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRows(ingredients.filter((_, j) => j !== i));
                          setEditRow((e) => (e === i ? null : e != null && e > i ? e - 1 : e));
                        }}
                        aria-label={`Remove ${row.name}`}
                        className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-2"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                    {isEditing && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="relative w-28">
                          <input
                            autoFocus
                            inputMode="decimal"
                            enterKeyHint="done"
                            aria-label={`${isServingRow(row) ? "Servings" : "Grams"} of ${row.name}`}
                            value={row.qty}
                            onChange={(e) => updateRow(i, { qty: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && setEditRow(null)}
                            className={cn(field, "h-12 border-2 border-ink pr-8")}
                          />
                          <span className="pointer-events-none absolute right-3 top-0 flex h-12 items-center text-sm text-ink-3">{isServingRow(row) ? "srv" : "g"}</span>
                        </span>
                        <span className="contents">
                          {(row.portions ?? []).slice(0, 2).map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              className="chip sm"
                              onClick={() => updateRow(i, { qty: String(p.grams) })}
                            >
                              1 {p.label} · {fmtG(p.grams)} g
                            </button>
                          ))}
                          <button
                            type="button"
                            className="chip sm"
                            onClick={() => {
                              const g = num(row.qty);
                              if (g) updateRow(i, { qty: String(round2(g * 2)) });
                            }}
                          >
                            ×2
                          </button>
                          <button type="button" className="chip sm ml-auto" onClick={() => setEditRow(null)}>
                            <Check className="size-4" /> Done
                          </button>
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setDialog("scan")} className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-surface-2 font-semibold">
              <ScanBarcode className="size-5" /> Scan
            </button>
            <button type="button" onClick={() => setDialog("picker")} className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-surface-2 font-semibold">
              <Search className="size-5" /> Add product
            </button>
          </div>
        </section>

        <Section title="Servings & weighing" open={open.servings} onToggle={() => setOpen((o) => ({ ...o, servings: !o.servings }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className={labelCls}>Makes</span>
              <Stepper value={serves} onChange={setServes} step={1} min={1} label="Servings" />
            </div>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={labelCls}>One serving is</span>
              <input value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="1 bowl" className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Cooked weight of whole pot (optional)</span>
            <span className="relative">
              <input inputMode="decimal" value={cookedGrams} onChange={(e) => setCookedGrams(e.target.value)} className={cn(field, "pr-9")} />
              <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">g</span>
            </span>
            <span className="text-[13px] text-ink-3">Weigh the food after cooking, without the pot. Lets you log any portion by weight.</span>
          </label>
          {servingGrams && (
            <div className="rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-sm">
              <p className="text-xs text-ink-3">So each {noun} is</p>
              <p>
                <b className="num text-lg">{fmtG(servingGrams)} g</b> cooked · {fmtKcal((perServing.kcal / servingGrams) * 100)} kcal and{" "}
                Protein {fmtG((perServing.protein / servingGrams) * 100)} g per 100 g
              </p>
            </div>
          )}
        </Section>

        <Section title="Macros" open={open.macros || manualMode} onToggle={() => setOpen((o) => ({ ...o, macros: !o.macros }))}>
          <div className="seg w-full" role="radiogroup" aria-label="Macros come from">
            <button type="button" role="radio" aria-checked={!manualMode} disabled={!hasCounted} className={cn("flex-1", !manualMode && "on")} onClick={() => setMacrosManual(false)}>
              From ingredients
            </button>
            <button type="button" role="radio" aria-checked={manualMode} className={cn("flex-1", manualMode && "on")} onClick={() => setMacrosManual(true)}>
              Enter manually
            </button>
          </div>
          {manualMode ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(["kcal", "protein"] as const).map((k) => (
                  <label key={k} className="flex min-w-0 flex-col gap-1.5">
                    <span className={cn(labelCls, "flex items-center gap-1.5")}>
                      {k === "protein" && <span className="mdot m-p" aria-hidden />}
                      {k === "kcal" ? "Calories" : "Protein"}
                    </span>
                    <input inputMode="decimal" value={manual[k]} onChange={(e) => setManual((v) => ({ ...v, [k]: e.target.value }))} className={field} />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MACROS_UI.slice(1).map((m) => (
                  <label key={m.key} className="flex min-w-0 flex-col gap-1.5">
                    <span className={cn(labelCls, "flex items-center gap-1")}>
                      <span className={cn("mdot", m.cls)} aria-hidden />
                      <span className="truncate">{m.label}</span>
                    </span>
                    <input
                      inputMode="decimal"
                      aria-label={`${m.label} grams`}
                      value={manual[m.key]}
                      onChange={(e) => setManual((v) => ({ ...v, [m.key]: e.target.value }))}
                      className={cn(field, "pl-3")}
                    />
                  </label>
                ))}
              </div>
              <p className="text-[13px] text-ink-3">
                Per {noun}. Manual is for recipes you didn&apos;t build from products, e.g. a restaurant dish.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-ink-3">Totals come from the ingredients ÷ {fmtG(servesNum)} servings.</p>
          )}
        </Section>

        <Section title={`Prep steps · ${steps.length}`} open={open.steps} onToggle={() => setOpen((o) => ({ ...o, steps: !o.steps }))}>
          <ol ref={listRef} className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={s.id} data-step className="flex items-start gap-2.5">
                <span className="num mt-3 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
                <textarea
                  data-step-input={s.id}
                  rows={1}
                  enterKeyHint="next"
                  value={s.text}
                  aria-label={`Step ${i + 1}`}
                  onChange={(e) => setSteps((list) => list.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addStepAfter(i);
                    } else if (e.key === "Backspace" && s.text === "" && steps.length > 1) {
                      e.preventDefault();
                      setSteps((list) => list.filter((x) => x.id !== s.id));
                      setFocusStep(steps[Math.max(0, i - 1)].id);
                    }
                  }}
                  className="min-h-12 flex-1 resize-none rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-base outline-none [field-sizing:content] focus:border-2 focus:border-ink"
                />
                <button
                  type="button"
                  aria-label={`Drag to reorder step ${i + 1}`}
                  className="mt-1 grid size-11 shrink-0 touch-none place-items-center text-ink-3"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragId.current = s.id;
                  }}
                  onPointerMove={onDragMove}
                  onPointerUp={() => (dragId.current = null)}
                  onPointerCancel={() => (dragId.current = null)}
                >
                  <GripVertical className="size-5" />
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => addStepAfter(steps.length - 1)} className="press flex h-12 items-center justify-center gap-2 rounded-[14px] border border-line font-semibold">
            <Plus className="size-4" /> Add step
          </button>
        </Section>

        <section className="card flex flex-col gap-3 p-4" aria-label="Tags">
          <div className="flex items-center justify-between">
            <h2 className="t-h3">Tags</h2>
            <button type="button" className="chip sm" onClick={() => setDialog("tags")}>
              <Tag className="size-4" /> Edit tags
            </button>
          </div>
          {selectedTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((t) => (
                <span key={t.id} className="tag" style={tagStyle(t.color)}>
                  {t.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">Batch cook, breakfast, high protein… they become filters in the Library.</p>
          )}
        </section>

        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}
        {initial && (
          <p className="text-[13px] text-ink-3">Changes apply to today and upcoming days. Past days keep what was logged.</p>
        )}
      </div>

      {dialog === "scan" && (
        <ScanProductDialog
          title="Scan an ingredient"
          confirmLabel="Add ingredient"
          gramsLabel="How many grams in the recipe?"
          onConfirm={async (p, grams) => {
            // Keep the product in the database (a plain Open Food Facts hit isn't
            // saved yet; an edited one is left as is) and use the stored row.
            const saved = await importOffProductAction({
              barcode: p.barcode,
              name: p.name,
              brand: p.brand,
              servingLabel: p.servingLabel,
              servingGrams: p.servingGrams,
              ...p.per100g,
            }).catch(() => null);
            if (saved?.ok) {
              addProductRow(saved.product, grams);
              // Reload the product list so it shows in "Add product" without a
              // page reload (the form's own state is kept).
              router.refresh();
              return true;
            }
            appendRow({
              name: p.name,
              qty: String(grams),
              unit: "g",
              note: "",
              barcode: p.barcode,
              per100g: hasAnyMacro(p.per100g) ? p.per100g : null,
              portions: [],
            });
            return true;
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "picker" && (
        <ProductPickerDialog products={products} usage={productUsage} onPick={(p) => addProductRow(p)} onClose={() => setDialog(null)} />
      )}
      {dialog === "tags" && (
        <TagSheet
          tags={allTags}
          selected={selected}
          onToggle={toggleTag}
          onCreated={(t) => {
            setAllTags((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
            setSelected((prev) => new Set(prev).add(t.id));
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </FlowScreen>
  );
}

/** Half sheet: tap a tag to toggle it, or create one with a tint. */
function TagSheet({
  tags,
  selected,
  onToggle,
  onCreated,
  onClose,
}: {
  tags: TagItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onCreated: (t: TagItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [tint, setTint] = useState<TagTint>("sand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const res = await createTagAction(n, tint);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onCreated(res);
    setName("");
  }

  return (
    <Sheet label="Tags" onClose={onClose}>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="t-h2">Tags</h2>
          <button type="button" onClick={onClose} className="h-11 px-1 font-semibold">
            Done
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && <p className="text-sm text-ink-3">No tags yet. Create one below.</p>}
          {tags.map((t) => {
            const on = selected.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(t.id)}
                className={cn("chip sm", on && "border-ink")}
                style={on ? tagStyle(t.color) : undefined}
              >
                {on && <Check className="size-4" />} {t.name}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>New tag</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void create();
                }
              }}
              enterKeyHint="done"
              placeholder="e.g. Post-workout"
              className={field}
            />
          </label>
          <div>
            <span className={labelCls}>Color</span>
            <div className="mt-1.5 flex gap-2.5" role="radiogroup" aria-label="Tag color">
              {TAG_TINTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tint === t}
                  aria-label={t}
                  onClick={() => setTint(t)}
                  className={cn("size-11 rounded-full border", tint === t ? "border-2 border-ink" : "border-line")}
                  style={{ background: `var(--tag-${t})` }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-ink-3">Tags use pale tints with dark text, so they never look like macro colors.</p>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <Button type="button" variant="secondary" size="lg" disabled={busy || !name.trim()} onClick={() => void create()}>
            {busy && <Loader2 className="animate-spin" />}
            {name.trim() ? `Create “${name.trim()}”` : "Create tag"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
