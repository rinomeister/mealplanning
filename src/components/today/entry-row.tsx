"use client";

import { useState } from "react";
import { AlertTriangle, Check, MoreHorizontal } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { fmtG, fmtKcal, macrosOf } from "@/lib/macro-format";
import { portionChoices } from "@/lib/products";
import { useLongPress } from "@/lib/use-long-press";
import { MacroDot, MacroGrid } from "@/components/macro-ui";
import { KeyboardBar } from "@/components/keyboard-bar";
import { Button } from "@/components/ui/button";
import type { DayEntry } from "@/lib/day-entry";

/** How an entry's amount is edited: grams, or servings. */
export function amountMode(e: DayEntry): "grams" | "servings" | null {
  if (e.kind === "quick") return null;
  if (e.kind === "product" || e.gramsPerServing != null) return "grams";
  return "servings";
}

export function currentAmount(e: DayEntry): number {
  if (e.kind === "product") return e.grams ?? 0;
  if (e.gramsPerServing != null) return Math.round(e.grams ?? e.servings * e.gramsPerServing);
  return e.servings;
}

/** The entry with a new amount applied (grams or servings). */
export function withAmount(e: DayEntry, value: number): DayEntry {
  if (e.kind === "product") return { ...e, grams: value };
  if (e.gramsPerServing != null) {
    return { ...e, grams: value, servings: value / e.gramsPerServing };
  }
  return { ...e, servings: value };
}

const plural = (n: number, one: string, many: string) => `${fmtG(n)} ${n === 1 ? one : many}`;

/** "1 pot · 150 g", "420 g", "1.5 servings", "Quick add". */
export function amountText(e: DayEntry): string {
  if (e.kind === "quick") return "Quick add";
  if (e.kind === "product") {
    const g = e.grams ?? 0;
    const match = portionChoices({ servingGrams: e.servingGrams, portions: e.portions }).find(
      (p) => p.grams > 0 && Math.abs(g / p.grams - Math.round(g / p.grams)) < 0.01 && Math.round(g / p.grams) >= 1,
    );
    if (match) return `${Math.round(g / match.grams)} ${match.label} · ${fmtG(g)} g`;
    return `${fmtG(g)} g`;
  }
  if (e.gramsPerServing != null) return `${fmtG(currentAmount(e))} g`;
  return plural(e.servings, "serving", "servings");
}

type Chip = { label: string; value: number };

function chipsFor(e: DayEntry): Chip[] {
  const mode = amountMode(e);
  if (mode === "servings") {
    return [0.5, 1, 1.5, 2].map((v) => ({ label: `${fmtG(v)}`, value: v }));
  }
  if (e.kind === "meal" && e.gramsPerServing != null) {
    const g = e.gramsPerServing;
    return [
      { label: "½ serving", value: Math.round(g / 2) },
      { label: "1 serving", value: Math.round(g) },
    ];
  }
  const list = portionChoices({ servingGrams: e.servingGrams, portions: e.portions }).map((p) => ({
    label: `1 ${p.label}`,
    value: Math.round(p.grams * 10) / 10,
  }));
  if (!list.some((c) => c.value === 100)) list.push({ label: "100 g", value: 100 });
  return list;
}

/**
 * One logged item. The circle toggles planned ↔ eaten; tapping the row edits
 * the amount in place (with a keyboard bar); long-press opens the entry menu,
 * which is also reachable from the editor's ⋯ button.
 */
export function EntryRow({
  entry,
  editing,
  onEdit,
  onToggleEaten,
  onCommitAmount,
  onOpenMenu,
}: {
  entry: DayEntry;
  editing: boolean;
  onEdit: (editing: boolean) => void;
  onToggleEaten: () => void;
  onCommitAmount: (value: number) => void;
  onOpenMenu: () => void;
}) {
  const mode = amountMode(entry);
  const [draft, setDraft] = useState(String(currentAmount(entry)));
  const lp = useLongPress(onOpenMenu);
  const skipped = entry.status === "SKIPPED";
  const eaten = entry.status === "EATEN";

  const parsed = parseDecimal(draft);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const shown = editing && valid ? withAmount(entry, parsed) : entry;
  const m = macrosOf({ ...shown.basis, servings: shown.servings, grams: shown.grams, productId: shown.productId });
  const unit = mode === "grams" ? "g" : parsed === 1 ? "serving" : "servings";

  function startEdit() {
    if (lp.wasLongPress()) return;
    if (!mode) {
      onOpenMenu();
      return;
    }
    setDraft(String(currentAmount(entry)));
    onEdit(true);
  }

  function done() {
    if (valid && parsed !== currentAmount(entry)) onCommitAmount(parsed);
    onEdit(false);
  }

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleEaten}
          className={cn("check", eaten && "done", skipped && "skip")}
          aria-pressed={eaten}
          aria-label={
            skipped ? `Restore ${entry.name}` : eaten ? `Mark ${entry.name} as not eaten` : `Mark ${entry.name} eaten`
          }
        >
          {eaten && <Check className="size-4" strokeWidth={3} />}
        </button>

        <button
          type="button"
          onClick={startEdit}
          {...lp.handlers}
          className="flex min-h-11 min-w-0 flex-1 select-none items-center gap-3 text-left [-webkit-touch-callout:none]"
          aria-label={mode ? `${entry.name}, ${amountText(entry)}. Change amount` : `${entry.name}. Options`}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={cn("truncate text-base", skipped && "text-ink-3 line-through")}>
                {entry.name}
              </span>
              {!entry.hasMacros && (
                <AlertTriangle className="size-4 shrink-0 text-carb" aria-label="No macros — not counted" />
              )}
            </span>
            <span className="block truncate text-[13px] text-ink-3">
              {editing ? (
                `live: ${fmtKcal(m.kcal)} kcal · Protein ${fmtG(m.protein)} g`
              ) : (
                <>
                  {amountText(entry)}
                  {skipped && " · skipped"}
                </>
              )}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className={cn("num block text-base font-semibold", skipped && "text-ink-3")}>
              {fmtKcal(m.kcal)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
              <MacroDot macro="protein" />
              Protein <span className="num">{fmtG(m.protein)} g</span>
            </span>
          </span>
        </button>
      </div>

      {editing && mode && (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-10">
            <label className="relative w-28">
              <span className="sr-only">Amount in {unit}</span>
              <input
                autoFocus
                inputMode="decimal"
                enterKeyHint="done"
                value={draft}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") done();
                  if (e.key === "Escape") onEdit(false);
                }}
                aria-invalid={!valid}
                className="h-11 w-full rounded-[14px] border-2 border-ink bg-surface pl-3 pr-9 text-[17px] font-medium outline-none aria-[invalid=true]:border-bad"
              />
              <span className="pointer-events-none absolute right-3 top-0 flex h-11 items-center text-sm text-ink-3">
                {mode === "grams" ? "g" : "×"}
              </span>
            </label>
            {chipsFor(entry).map((c) => (
              <button
                key={c.label}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setDraft(String(c.value))}
                className={cn("chip sm", valid && parsed === c.value && "on")}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                onEdit(false);
                onOpenMenu();
              }}
              className="ml-auto grid size-11 place-items-center rounded-[14px] text-ink-2"
              aria-label={`More options for ${entry.name}`}
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
          {entry.hasMacros && <MacroGrid macros={m} className="mt-2.5 pl-10" />}
          <KeyboardBar>
            <Button type="button" variant="secondary" size="lg" onPointerDown={(e) => e.preventDefault()} onClick={() => onEdit(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={!valid}
              onPointerDown={(e) => e.preventDefault()}
              onClick={done}
            >
              Done{valid ? ` · ${fmtG(parsed)} ${mode === "grams" ? "g" : unit}` : ""}
            </Button>
          </KeyboardBar>
        </>
      )}
    </div>
  );
}
