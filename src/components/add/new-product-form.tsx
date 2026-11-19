"use client";

import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { FlowScreen } from "@/components/add/flow-screen";
import type { ConfirmProduct } from "@/components/add/product-confirm";
import { upsertProductMacrosAction } from "@/app/(app)/today/actions";
import { createProductAction } from "@/app/(app)/products/actions";

const FIELDS = [
  { key: "kcal", label: "Calories", letter: "", unit: "kcal", cls: "" },
  { key: "protein", label: "Protein", letter: "P", unit: "g", cls: "m-p" },
  { key: "carbs", label: "Carbs", letter: "C", unit: "g", cls: "m-c" },
  { key: "fat", label: "Fat", letter: "F", unit: "g", cls: "m-f" },
  { key: "sugar", label: "Sugar", letter: "S", unit: "g", cls: "m-s" },
  { key: "fiber", label: "Fiber", letter: "Fi", unit: "g", cls: "m-fi" },
] as const;

/**
 * Quick custom product: name and calories required, the rest optional, all
 * per 100 g. With a barcode it's saved against that code (so the next scan
 * finds it). Hands the saved product back for the amount step.
 */
export function NewProductForm({
  barcode,
  initialName = "",
  slot,
  onBack,
  onSaved,
}: {
  barcode?: string | null;
  initialName?: string;
  slot: SlotKey;
  onBack: () => void;
  onSaved: (product: ConfirmProduct) => void;
}) {
  const [name, setName] = useState(initialName);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [serving, setServing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const num = (v: string | undefined) => {
    if (!v || v.trim() === "") return null;
    const n = parseDecimal(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const kcal = num(vals.kcal);

  async function save() {
    if (name.trim() === "" || kcal == null) {
      setError("A name and calories are needed.");
      return;
    }
    setBusy(true);
    setError("");
    const sg = num(serving);
    const per100g = {
      kcal,
      protein: num(vals.protein),
      fat: num(vals.fat),
      carbs: num(vals.carbs),
      sugar: num(vals.sugar),
      fiber: num(vals.fiber),
    };
    const common = { name: name.trim(), brand: null, servingLabel: sg ? `${sg} g` : null, servingGrams: sg, ...per100g };
    const res = barcode
      ? await upsertProductMacrosAction({ barcode, ...common })
      : await createProductAction({ ...common, portions: [] });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved({
      id: barcode ? null : (res as { ok: true; id: string }).id,
      barcode: barcode ?? null,
      name: common.name,
      brand: null,
      servingGrams: sg,
      portions: [],
      per100g,
    });
  }

  const input =
    "h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface pl-3.5 pr-12 text-[17px] font-medium outline-none focus:border-2 focus:border-ink";

  return (
    <FlowScreen
      top={
        <div className="flex items-center gap-2 pb-3">
          <button type="button" onClick={onBack} className="grid size-11 place-items-center rounded-[14px]" aria-label="Back">
            <ChevronLeft className="size-5" />
          </button>
          <p className="t-h2 flex-1">New product</p>
        </div>
      }
      bottom={
        <Button type="button" size="lg" className="w-full" disabled={busy} onClick={save}>
          {busy && <Loader2 className="animate-spin" />} Save &amp; add to {SLOT_LABELS[slot]}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-sm text-ink-3">
          {barcode ? (
            <>
              Barcode <span className="num font-semibold text-ink-2">{barcode}</span>.{" "}
            </>
          ) : null}
          Copy the values per 100 g from the label — only name and calories are needed.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Name</span>
          <input autoFocus enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                {f.cls && <span className={cn("mb", f.cls)}>{f.letter}</span>}
                {f.label} <span className="font-normal text-ink-3">/ 100 g</span>
              </span>
              <span className="relative">
                <input
                  inputMode="decimal"
                  enterKeyHint="next"
                  value={vals[f.key] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={input}
                />
                <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">
                  {f.unit}
                </span>
              </span>
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">1 serving (optional)</span>
          <span className="relative">
            <input inputMode="decimal" enterKeyHint="done" value={serving} onChange={(e) => setServing(e.target.value)} className={input} />
            <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">g</span>
          </span>
        </label>
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>
    </FlowScreen>
  );
}
