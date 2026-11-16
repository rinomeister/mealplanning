"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtMacro } from "@/lib/macros";
import { portionChoices, type Portion } from "@/lib/products";

/**
 * One-tap weights for a product: "1 serving", "1 slice", "1 scoop"… Tapping
 * the same chip again counts up (2 slices, 3 slices) so a stack of identical
 * portions doesn't need maths. Typing in the grams box takes over again.
 */
export function PortionChips({
  servingGrams,
  portions,
  grams,
  onGrams,
}: {
  servingGrams: number | null;
  portions?: Portion[];
  grams: string;
  onGrams: (grams: string) => void;
}) {
  const choices = portionChoices({ servingGrams, portions });
  const [pick, setPick] = useState<{ label: string; count: number } | null>(null);

  if (choices.length === 0) return null;

  // Only keep the count while the grams box still shows what the chip set.
  const active =
    pick &&
    choices.some(
      (c) => c.label === pick.label && String(round(c.grams * pick.count)) === grams,
    )
      ? pick
      : null;

  function tap(c: Portion) {
    const count = active?.label === c.label ? active.count + 1 : 1;
    setPick({ label: c.label, count });
    onGrams(String(round(c.grams * count)));
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const on = active?.label === c.label;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => tap(c)}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors",
              on
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-foreground active:bg-muted",
            )}
          >
            {on ? `${active.count} × ` : "1 "}
            {c.label} · {fmtMacro(c.grams * (on ? active.count : 1))} g
          </button>
        );
      })}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
