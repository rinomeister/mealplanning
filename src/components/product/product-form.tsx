"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { scanLabel } from "@/lib/label-scan";
import { cn, parseDecimal } from "@/lib/utils";
import { fmtG, fmtKcal } from "@/lib/macro-format";
import { SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import type { MealMacros } from "@/lib/macros";
import type { Portion } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { FlowScreen } from "@/components/add/flow-screen";
import type { ConfirmProduct } from "@/components/add/product-confirm";
import { createProductAction, updateProductAction } from "@/app/(app)/products/actions";
import { useSaveShortcut } from "@/lib/use-save-shortcut";

type Basis = "100g" | "100ml" | "serving";
const MACRO_KEYS = ["kcal", "protein", "carbs", "fat", "sugar", "fiber"] as const;
type MacroKey = (typeof MACRO_KEYS)[number];

const SMALL_FIELDS = [
  { key: "carbs", label: "Carbs", letter: "C", cls: "m-c" },
  { key: "fat", label: "Fat", letter: "F", cls: "m-f" },
  { key: "sugar", label: "Sug.", letter: "S", cls: "m-s" },
  { key: "fiber", label: "Fib.", letter: "Fi", cls: "m-fi" },
] as const;

export type ProductFormInitial = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingLabel: string | null;
  servingGrams: number | null;
  per100g: MealMacros;
  portions: Portion[];
};

type PortionDraft = { label: string; grams: string };

const field =
  "h-[52px] w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-surface pl-3.5 text-[17px] font-medium outline-none focus:border-2 focus:border-ink";
const labelCls = "text-[13px] font-semibold text-ink-2";

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = parseDecimal(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

/** The default portion's label: "pot" stays "pot"; OFF's "30 g" reads as "serving". */
function defaultLabel(servingLabel: string | null): string {
  const s = servingLabel?.trim().replace(/^1\s+/, "") ?? "";
  return s && !/^\d/.test(s) ? s : "serving";
}

/**
 * The custom-product form (new and edit). Numbers go in the way the label
 * gives them — per 100 g, per 100 ml or per serving — and are stored per 100.
 * Only name and calories are required. Portions: the first is the default.
 *
 * Standalone (no onSaved) it saves and navigates; embedded in the scanner or
 * search it hands the saved product back for the amount step.
 */
export function ProductForm({
  initial,
  barcode: initialBarcode,
  initialName,
  addSlot,
  onCancel,
  onSaved,
  footer,
  embedded = false,
}: {
  initial?: ProductFormInitial;
  barcode?: string | null;
  initialName?: string;
  /** Shows "Save & add to <slot>". */
  addSlot?: SlotKey | null;
  onCancel: () => void;
  /** Called with the saved product; `add` is true for "Save & add". */
  onSaved: (product: ConfirmProduct, add: boolean) => void | Promise<void>;
  /** Rendered under the form (edit: delete). */
  footer?: React.ReactNode;
  embedded?: boolean;
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? initialName ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? initialBarcode ?? "");
  const [basis, setBasis] = useState<Basis>("100g");
  const [servingWeight, setServingWeight] = useState("");
  const [vals, setVals] = useState<Record<MacroKey, string>>(() => {
    const s = (v: number | null | undefined) => (v == null ? "" : String(r1(v)));
    return {
      kcal: s(initial?.per100g.kcal),
      protein: s(initial?.per100g.protein),
      carbs: s(initial?.per100g.carbs),
      fat: s(initial?.per100g.fat),
      sugar: s(initial?.per100g.sugar),
      fiber: s(initial?.per100g.fiber),
    };
  });
  const [portions, setPortions] = useState<PortionDraft[]>(() => {
    const list: PortionDraft[] = [];
    if (initial?.servingGrams) list.push({ label: defaultLabel(initial.servingLabel), grams: String(initial.servingGrams) });
    for (const p of initial?.portions ?? []) list.push({ label: p.label, grams: String(p.grams) });
    return list;
  });
  const [editingPortion, setEditingPortion] = useState<number | null>(null);
  const [busy, setBusy] = useState<null | "save" | "add">(null);
  const [error, setError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<{ state: "idle" | "busy" | "done" } | { state: "error"; message: string }>({ state: "idle" });

  async function onLabelPhoto(file: File | undefined) {
    if (!file) return;
    setScan({ state: "busy" });
    const r = await scanLabel(file);
    if (!r.ok) {
      setScan({ state: "error", message: r.error });
      return;
    }
    const s = (v: number | null) => (v == null ? "" : String(r1(v)));
    setVals({ kcal: s(r.kcal), protein: s(r.protein), carbs: s(r.carbs), fat: s(r.fat), sugar: s(r.sugar), fiber: s(r.fiber) });
    setBasis(r.basis);
    if (!name.trim() && r.name) setName(r.name);
    if (!brand.trim() && r.brand) setBrand(r.brand);
    if (r.basis === "serving") {
      setServing(r.servingGrams ? String(r1(r.servingGrams)) : "");
    } else if (r.servingGrams && portions.length === 0) {
      setPortions([{ label: "serving", grams: String(r1(r.servingGrams)) }]);
    }
    setError("");
    setScan({ state: "done" });
  }

  const unit = basis === "100ml" ? "ml" : "g";
  const sw = num(servingWeight);
  // Entered numbers → per 100 g/ml.
  const factor = basis === "serving" ? (sw && sw > 0 ? 100 / sw : null) : 1;
  const per100 = Object.fromEntries(
    MACRO_KEYS.map((k) => {
      const v = num(vals[k]);
      return [k, v == null || factor == null ? null : r1(v * factor)];
    }),
  ) as Record<MacroKey, number | null>;

  // Label check: 4 / 4 / 9 kcal per gram of protein / carbs / fat.
  const entered = num(vals.kcal);
  const fromMacros = (num(vals.protein) ?? 0) * 4 + (num(vals.carbs) ?? 0) * 4 + (num(vals.fat) ?? 0) * 9;
  const off = entered && fromMacros > 0 ? Math.abs(fromMacros - entered) / entered : null;

  function setServing(v: string) {
    setServingWeight(v);
    // A per-serving label makes that serving the default portion.
    setPortions((list) => {
      const g = v.trim();
      if (list[0]?.label === "serving") return [{ label: "serving", grams: g }, ...list.slice(1)];
      return g ? [{ label: "serving", grams: g }, ...list] : list;
    });
  }

  function updatePortion(i: number, patch: Partial<PortionDraft>) {
    setPortions((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function save(add: boolean) {
    if (name.trim() === "") {
      setError("Give it a name.");
      return;
    }
    if (entered == null) {
      setError("Enter the calories.");
      return;
    }
    if (basis === "serving" && !(sw && sw > 0)) {
      setError("Enter what one serving weighs.");
      return;
    }
    if (barcode.trim() && !/^\d{6,14}$/.test(barcode.trim())) {
      setError("A barcode is 6–14 digits.");
      return;
    }
    const clean = portions.flatMap((p) => {
      const label = p.label.trim().replace(/^1\s+/, "");
      const g = num(p.grams);
      return label && g && g > 0 ? [{ label, grams: g }] : [];
    });
    const [def, ...rest] = clean;
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: barcode.trim(),
      servingLabel: def ? `1 ${def.label}` : null,
      servingGrams: def?.grams ?? null,
      ...per100,
      portions: rest,
    };
    setBusy(add ? "add" : "save");
    setError("");
    const res = editing
      ? await updateProductAction({ ...payload, id: initial.id })
      : await createProductAction(payload);
    if (!res.ok) {
      setBusy(null);
      setError(res.error);
      return;
    }
    await onSaved(
      {
        id: editing ? initial.id : (res as { ok: true; id: string }).id,
        barcode: barcode.trim() || null,
        name: payload.name,
        brand: payload.brand,
        servingGrams: payload.servingGrams,
        portions: def && def.label !== "serving" ? [def, ...rest] : rest,
        per100g: per100,
      },
      add,
    );
    setBusy(null);
  }

  useSaveShortcut(() => {
    if (busy == null) void save(false);
  });

  const title = editing ? "Edit product" : name.trim() || "New product";

  return (
    <FlowScreen
      top={
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3">
          <button type="button" onClick={onCancel} className="-ml-1 h-11 px-1 font-semibold">
            Cancel
          </button>
          <h1 className="truncate text-center font-semibold">{title}</h1>
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={busy != null}
            className={cn("-mr-1 h-11 px-1 font-semibold", (name.trim() === "" || entered == null) && "text-ink-3")}
          >
            {busy === "save" ? <Loader2 className="size-5 animate-spin" /> : "Save"}
          </button>
        </div>
      }
      bottom={
        embedded ? (
          <Button type="button" size="lg" className="w-full" disabled={busy != null} onClick={() => void save(true)}>
            {busy && <Loader2 className="animate-spin" />} Save &amp; choose amount
          </Button>
        ) : addSlot ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="lg" className="w-[34%]" disabled={busy != null} onClick={() => void save(false)}>
              {busy === "save" && <Loader2 className="animate-spin" />} Save
            </Button>
            <Button type="button" size="lg" className="flex-1" disabled={busy != null} onClick={() => void save(true)}>
              {busy === "add" && <Loader2 className="animate-spin" />} Save &amp; add to {SLOT_LABELS[addSlot]}
            </Button>
          </div>
        ) : undefined
      }
    >
      <form
        className="flex flex-col gap-4 pb-8"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Name</span>
          <input
            autoFocus={!editing}
            autoComplete="off"
            enterKeyHint="next"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Granola, home-made"
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelCls}>Brand {editing ? "" : "(optional)"}</span>
            <input autoComplete="off" enterKeyHint="next" value={brand} onChange={(e) => setBrand(e.target.value)} className={field} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelCls}>Barcode {editing ? "" : "(optional)"}</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              enterKeyHint="next"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))}
              className={cn(field, "num")}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onLabelPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={scan.state === "busy"}
            onClick={() => photoInput.current?.click()}
            className="press flex h-[52px] items-center justify-center gap-2 rounded-btn bg-surface-2 font-semibold"
          >
            {scan.state === "busy" ? (
              <>
                <Loader2 className="size-5 animate-spin" /> Reading the label…
              </>
            ) : (
              <>
                <Camera className="size-5" /> {scan.state === "done" ? "Scan the label again" : "Scan the nutrition label"}
              </>
            )}
          </button>
          {scan.state === "done" && (
            <p className="text-[13px] text-ink-2">Filled in from the photo. Check the numbers against the label before saving.</p>
          )}
          {scan.state === "error" && (
            <p className="text-[13px] text-bad" role="alert">
              {scan.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelCls} id="basis-label">My numbers are</span>
          <div className="seg w-full" role="radiogroup" aria-labelledby="basis-label">
            {(
              [
                ["100g", "per 100 g"],
                ["100ml", "per 100 ml"],
                ["serving", "per serving"],
              ] as const
            ).map(([b, l]) => (
              <button key={b} type="button" role="radio" aria-checked={basis === b} className={cn(basis === b && "on")} onClick={() => setBasis(b)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {basis === "serving" && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>One serving weighs</span>
            <span className="relative">
              <input inputMode="decimal" enterKeyHint="next" value={servingWeight} onChange={(e) => setServing(e.target.value)} className={cn(field, "pr-10")} />
              <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">g</span>
            </span>
          </label>
        )}

        <section className="card flex flex-col gap-3.5 p-4" aria-label="Nutrition">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={labelCls}>Calories</span>
              <span className="relative">
                <input inputMode="decimal" enterKeyHint="next" value={vals.kcal} onChange={(e) => setVals((v) => ({ ...v, kcal: e.target.value }))} className={cn(field, "pr-12")} />
                <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">kcal</span>
              </span>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={cn(labelCls, "flex items-center gap-1.5")}>
                <span className="mdot m-p" aria-hidden /> Protein
              </span>
              <span className="relative">
                <input inputMode="decimal" enterKeyHint="next" value={vals.protein} onChange={(e) => setVals((v) => ({ ...v, protein: e.target.value }))} className={cn(field, "pr-9")} />
                <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">g</span>
              </span>
            </label>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {SMALL_FIELDS.map((f, i) => (
              <label key={f.key} className="flex min-w-0 flex-col gap-1.5">
                <span className={cn(labelCls, "flex items-center gap-1")}>
                  <span className={cn("mdot", f.cls)} aria-hidden />
                  <span className="truncate">{f.label}</span>
                </span>
                <input
                  inputMode="decimal"
                  enterKeyHint={i === SMALL_FIELDS.length - 1 ? "done" : "next"}
                  aria-label={`${f.label} grams`}
                  value={vals[f.key]}
                  onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={cn(field, "pl-3")}
                />
              </label>
            ))}
          </div>

          {basis === "serving" && factor != null && per100.kcal != null && (
            <div className="rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[13px]">
              Saved as{" "}
              <b>
                per 100 g: {fmtKcal(per100.kcal)} kcal · Protein {fmtG(per100.protein ?? 0)} g · Carbs {fmtG(per100.carbs ?? 0)} g · Fat {fmtG(per100.fat ?? 0)} g
              </b>
            </div>
          )}
          {off != null && (
            <p className={cn("text-[13px]", off > 0.15 ? "text-bad" : "text-ink-3")}>
              Macros add up to {fmtKcal(fromMacros)} kcal
              {off <= 0.15 ? (
                <>
                  {" "}
                  · matches the label within {Math.max(1, Math.round(off * 100))}% <Check className="inline size-3.5" />
                </>
              ) : (
                ` · ${Math.round(off * 100)}% off the calories, check the numbers`
              )}
            </p>
          )}
          {basis === "100ml" && <p className="text-[13px] text-ink-3">Logged by weight as if 1 ml = 1 g.</p>}
        </section>

        <section className="card flex flex-col p-4" aria-label="Portions">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="t-h3">Portions</h2>
            <span className="text-xs text-ink-3">Default first</span>
          </div>
          {portions.length === 0 && (
            <p className="border-t border-line py-3 text-sm text-ink-3">
              E.g. 1 slice = 25 g, 1 scoop = 30 g. They become one-tap amounts when you log.
            </p>
          )}
          <ul className="flex flex-col">
            {portions.map((p, i) =>
              editingPortion === i ? (
                <li key={i} className="flex flex-col gap-2 border-t border-line py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-3">1</span>
                    <input
                      autoFocus
                      aria-label="Portion name"
                      placeholder="slice"
                      value={p.label}
                      onChange={(e) => updatePortion(i, { label: e.target.value })}
                      className={cn(field, "h-11 flex-1 text-base")}
                    />
                    <span className="relative w-28 shrink-0">
                      <input
                        inputMode="decimal"
                        aria-label="Grams"
                        placeholder="25"
                        value={p.grams}
                        onChange={(e) => updatePortion(i, { grams: e.target.value })}
                        className={cn(field, "h-11 pr-8 text-base")}
                      />
                      <span className="pointer-events-none absolute right-3 top-0 flex h-11 items-center text-sm text-ink-3">{unit}</span>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {i > 0 && (
                      <button
                        type="button"
                        className="chip sm"
                        onClick={() => {
                          setPortions((list) => [list[i], ...list.filter((_, j) => j !== i)]);
                          setEditingPortion(0);
                        }}
                      >
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip sm text-bad"
                      onClick={() => {
                        setPortions((list) => list.filter((_, j) => j !== i));
                        setEditingPortion(null);
                      }}
                    >
                      <Trash2 className="size-4" /> Remove
                    </button>
                    <button type="button" className="chip sm ml-auto" onClick={() => setEditingPortion(null)}>
                      <Check className="size-4" /> Done
                    </button>
                  </div>
                </li>
              ) : (
                <li key={i} className="flex min-h-14 items-center gap-2.5 border-t border-line">
                  {i === 0 && <span className="tag bg-ink text-inv">Default</span>}
                  <span className="min-w-0 flex-1 truncate">1 {p.label || "…"}</span>
                  <span className="num font-semibold">
                    {p.grams || "–"} {unit}
                  </span>
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-full text-ink-2"
                    aria-label={`Edit portion ${p.label}`}
                    onClick={() => setEditingPortion(i)}
                  >
                    <Pencil className="size-4" />
                  </button>
                </li>
              ),
            )}
          </ul>
          {portions.length < 20 && (
            <button
              type="button"
              className="flex min-h-12 items-center gap-2 border-t border-line text-sm font-semibold"
              onClick={() => {
                setPortions((list) => [...list, { label: "", grams: "" }]);
                setEditingPortion(portions.length);
              }}
            >
              <Plus className="size-4" /> Add {portions.length ? "another " : "a "}portion
            </button>
          )}
        </section>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-bad" role="alert">
            <X className="size-4" /> {error}
          </p>
        )}
        {footer}
      </form>
    </FlowScreen>
  );
}
