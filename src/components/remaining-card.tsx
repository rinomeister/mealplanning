"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fmtMacro } from "@/lib/macros";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { addPlanEntryAction } from "@/app/(app)/plan/actions";
import type { SuggestMeal } from "@/lib/suggest";

type Remaining = {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sugar: number | null;
  fiber: number | null;
};

/**
 * "You have 500 kcal and 40 g protein left" — the remaining budget in one
 * sentence, any blown ceilings called out, and a few saved meals that still fit,
 * each one tap from being added to the next open slot.
 */
export function RemainingCard({
  date,
  isToday,
  remaining,
  suggestions,
  defaultSlot,
}: {
  date: string;
  isToday: boolean;
  remaining: Remaining;
  suggestions: SuggestMeal[];
  defaultSlot: SlotKey;
}) {
  const [slot, setSlot] = useState<SlotKey>(defaultSlot);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Non-breaking spaces keep "13.7 g fiber" on one line on narrow phones.
  const NB = " ";
  const parts: string[] = [];
  if (remaining.kcal != null && remaining.kcal > 0) parts.push(`${fmtMacro(remaining.kcal, "kcal")}${NB}kcal`);
  if (remaining.protein != null && remaining.protein > 0) parts.push(`${fmtMacro(remaining.protein)}${NB}g${NB}protein`);
  if (remaining.fiber != null && remaining.fiber > 0) parts.push(`${fmtMacro(remaining.fiber)}${NB}g${NB}fiber`);

  const over: string[] = [];
  if (remaining.kcal != null && remaining.kcal < 0) over.push(`${fmtMacro(-remaining.kcal, "kcal")}${NB}kcal`);
  for (const [k, label] of [["fat", "fat"], ["carbs", "carbs"], ["sugar", "sugar"]] as const) {
    const v = remaining[k];
    if (v != null && v < 0) over.push(`${fmtMacro(-v)}${NB}g${NB}${label}`);
  }

  if (parts.length === 0 && over.length === 0) return null;

  function add(mealId: string) {
    setPendingId(mealId);
    startTransition(async () => {
      const res = await addPlanEntryAction({ date, slot, mealId, servings: "1" });
      setPendingId(null);
      if (res.ok) setAdded((prev) => new Set(prev).add(mealId));
    });
  }

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3">
        <div>
          {parts.length > 0 ? (
            <p className="text-base">
              {isToday ? "You have " : "That leaves "}
              <span className="font-semibold">{joinWords(parts)}</span> left
              {isToday ? " today." : "."}
            </p>
          ) : (
            <p className="text-base font-semibold">Targets reached for the day.</p>
          )}
          {over.length > 0 && (
            <p className="mt-1 text-sm text-destructive">Over by {joinWords(over)}.</p>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-4 text-primary" /> Meals that fit
              </p>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Add to
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value as SlotKey)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="flex flex-col gap-1.5">
              {suggestions.map((m) => {
                const done = added.has(m.id);
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/meals/${m.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {fmtMacro(m.kcal ?? 0, "kcal")} kcal
                        {m.protein != null && ` · ${fmtMacro(m.protein)} g protein`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isPending || done}
                      onClick={() => add(m.id)}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-primary active:bg-muted disabled:opacity-60"
                    >
                      {pendingId === m.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : done ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      {done ? "Added" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
