"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, Package, Star } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { hasAnyMacro, scaleGrams, type Macros, type MealMacros } from "@/lib/macros";
import { MACROS_UI, fmtG, fmtKcal, type Targets } from "@/lib/macro-format";
import { portionChoices, type Portion } from "@/lib/products";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { MacroBadge, MacroBar } from "@/components/macro-ui";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";

export type ConfirmProduct = {
  /** Our product id; null for a scanned barcode we don't hold yet. */
  id: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  servingGrams: number | null;
  portions: Portion[];
  per100g: MealMacros;
};

/** Native select dressed as a button: picking a slot is a plain choice. */
export function SlotSelect({
  slot,
  onSlot,
  className,
}: {
  slot: SlotKey;
  onSlot: (s: SlotKey) => void;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex h-[52px] items-center rounded-btn bg-surface-2 pl-4 pr-9 font-semibold", className)}>
      <span className="sr-only">Slot</span>
      {SLOT_LABELS[slot]}
      <ChevronDown className="pointer-events-none absolute right-3 size-4" />
      <select
        value={slot}
        onChange={(e) => onSlot(e.target.value as SlotKey)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Slot"
      >
        {SLOTS.map((s) => (
          <option key={s} value={s}>
            {SLOT_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Confirm amount for a product: portion chips (incl. "Last"), a gram stepper,
 * a live macro preview, and what the day looks like after adding.
 */
export function ProductConfirm({
  product,
  lastGrams,
  slot,
  onSlot,
  eaten,
  targets,
  favorite,
  onToggleFavorite,
  onAdd,
}: {
  product: ConfirmProduct;
  lastGrams: number | null;
  slot: SlotKey;
  onSlot: (s: SlotKey) => void;
  /** What's eaten so far on the day, for the "after adding" line. */
  eaten: Macros;
  targets: Targets;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onAdd: (grams: number) => Promise<boolean>;
}) {
  const initial = lastGrams ?? product.servingGrams ?? 100;
  const [grams, setGrams] = useState(String(Math.round(initial * 10) / 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const g = parseDecimal(grams);
  const valid = Number.isFinite(g) && g > 0;
  const m = scaleGrams(product.per100g, valid ? g : 0);
  const noMacros = !hasAnyMacro(product.per100g);

  const chips: { label: string; grams: number }[] = [{ label: "100 g", grams: 100 }];
  for (const p of portionChoices({ servingGrams: product.servingGrams, portions: product.portions })) {
    chips.push({ label: `1 ${p.label} · ${fmtG(p.grams)} g`, grams: p.grams });
  }
  if (lastGrams != null && !chips.some((c) => c.grams === lastGrams)) {
    chips.push({ label: `Last · ${fmtG(lastGrams)} g`, grams: lastGrams });
  }

  const per = product.per100g;
  const sub = [
    product.brand,
    per.kcal != null ? `per 100 g: ${fmtKcal(per.kcal)} kcal${per.protein != null ? ` · Protein ${fmtG(per.protein)} g` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const afterProtein = eaten.protein + m.protein;
  const afterKcalLeft = targets.kcal != null ? targets.kcal - eaten.kcal - m.kcal : null;

  async function add() {
    if (!valid) return;
    setBusy(true);
    setError("");
    const ok = await onAdd(g);
    setBusy(false);
    if (!ok) setError("Couldn't add that — try again.");
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-thumb bg-surface-2 text-ink-2">
          <Package className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight">{product.name}</p>
          {sub && <p className="mt-0.5 text-sm text-ink-3">{sub}</p>}
        </div>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="-mr-1 grid size-11 shrink-0 place-items-center rounded-[14px]"
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={favorite}
          >
            <Star className={cn("size-5", favorite && "fill-current")} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setGrams(String(c.grams))}
            className={cn("chip sm", valid && Math.abs(g - c.grams) < 0.05 && "on")}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Stepper value={grams} onChange={setGrams} step={5} min={0} unit="g" label="grams" />

      {noMacros ? (
        <p className="flex items-start gap-2 rounded-card bg-bad-t p-3 text-sm text-bad">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          This product has no macros, so it won&apos;t count toward your totals.
        </p>
      ) : (
        <div className="rounded-card border border-line p-4">
          <p className="flex items-baseline gap-1.5">
            <span className="num text-[28px] font-semibold leading-none">{fmtKcal(m.kcal)}</span>
            <span className="text-sm text-ink-3">kcal</span>
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {MACROS_UI.map((x) => (
              <div key={x.key}>
                <MacroBadge macro={x.key} />
                <p className="mt-1">
                  <span className="num font-semibold">{fmtG(m[x.key])}</span>
                  <span className="text-xs text-ink-3"> g</span>
                </p>
              </div>
            ))}
          </div>
          {targets.protein != null && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-1.5 text-[13px] text-ink-2">
                After adding · protein {fmtG(afterProtein)} / {fmtG(targets.protein)} g
                {afterKcalLeft != null &&
                  (afterKcalLeft >= 0 ? ` · ${fmtKcal(afterKcalLeft)} kcal left` : ` · ${fmtKcal(-afterKcalLeft)} kcal over`)}
              </p>
              <MacroBar macro="protein" eaten={eaten.protein} planned={m.protein} target={targets.protein} />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-bad">{error}</p>}

      <div className="flex gap-2">
        <SlotSelect slot={slot} onSlot={onSlot} />
        <Button type="button" size="lg" className="flex-1" disabled={!valid || busy} onClick={add}>
          {busy && <Loader2 className="animate-spin" />}
          Add {valid ? `${fmtG(g)} g` : ""}
        </Button>
      </div>
    </div>
  );
}
