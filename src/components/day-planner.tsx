"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, parseDecimal } from "@/lib/utils";
import { fmtMacro } from "@/lib/macros";
import {
  addPlanEntryAction,
  removePlanEntryAction,
  setEntryStatusAction,
  setServingsAction,
} from "@/app/(app)/calendar/actions";

export type DayEntry = {
  id: string;
  mealId: string;
  mealName: string;
  servings: number;
  status: "PLANNED" | "EATEN" | "SKIPPED";
  kcalPerServing: number | null;
};

export function PlanEntryRow({ entry }: { entry: DayEntry }) {
  const [isPending, startTransition] = useTransition();
  const [servings, setServings] = useState(String(entry.servings));
  const skipped = entry.status === "SKIPPED";

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
    });
  }

  function commitServings() {
    const n = parseDecimal(servings);
    if (!Number.isFinite(n) || n <= 0) {
      setServings(String(entry.servings));
      return;
    }
    if (n === entry.servings) return;
    run(() => setServingsAction(entry.id, n));
  }

  const kcal =
    entry.kcalPerServing != null
      ? fmtMacro(entry.kcalPerServing * entry.servings, "kcal")
      : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border px-2 py-1.5",
        skipped && "opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={!skipped}
        disabled={isPending}
        onChange={(e) =>
          run(() =>
            setEntryStatusAction(entry.id, e.target.checked ? "EATEN" : "SKIPPED"),
          )
        }
        className="size-4 accent-[var(--primary)]"
        aria-label="Ate this"
        title={skipped ? "Marked as not eaten" : "Counts toward the day"}
      />
      <Link
        href={`/meals/${entry.mealId}`}
        className={cn(
          "min-w-0 flex-1 truncate text-sm hover:underline",
          skipped && "line-through",
        )}
      >
        {entry.mealName}
      </Link>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">×</span>
        <Input
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          onBlur={commitServings}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          inputMode="decimal"
          className="h-7 w-12 px-1 text-center text-xs"
          aria-label="Servings"
        />
      </div>
      {kcal && (
        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
          {kcal} kcal
        </span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => removePlanEntryAction(entry.id))}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        aria-label="Remove"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </div>
  );
}

export type PickerTag = { id: string; name: string; color: string | null };
export type PickerMeal = {
  id: string;
  name: string;
  kcal: number | null;
  tagIds: string[];
};

export function AddMealControl({
  date,
  slot,
  slotLabel,
  meals,
  tags,
}: {
  date: string;
  slot: string;
  slotLabel: string;
  meals: PickerMeal[];
  tags: PickerTag[];
}) {
  const [open, setOpen] = useState(false);

  if (meals.length === 0) {
    return (
      <Link href="/meals/new" className="text-xs text-primary hover:underline">
        + Create a meal first
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="size-3.5" /> Add meal
      </button>
      {open && (
        <MealPickerDialog
          date={date}
          slot={slot}
          slotLabel={slotLabel}
          meals={meals}
          tags={tags}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MealPickerDialog({
  date,
  slot,
  slotLabel,
  meals,
  tags,
  onClose,
}: {
  date: string;
  slot: string;
  slotLabel: string;
  meals: PickerMeal[];
  tags: PickerTag[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = meals.filter((m) => {
    if (q && !m.name.toLowerCase().includes(q)) return false;
    for (const t of activeTags) if (!m.tagIds.includes(t)) return false;
    return true;
  });

  function toggleTag(id: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pick(mealId: string) {
    setPendingId(mealId);
    startTransition(async () => {
      const res = await addPlanEntryAction({ date, slot, mealId, servings: "1" });
      setPendingId(null);
      if (res.ok) {
        setAddedCount((prev) => ({ ...prev, [mealId]: (prev[mealId] ?? 0) + 1 }));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Add meal to ${slotLabel}`}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-card shadow-lg sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <div>
            <p className="text-sm font-semibold">Add to {slotLabel}</p>
            <p className="text-xs text-muted-foreground">
              {filtered.length} meal{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search meals…"
              className="pl-9"
            />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = activeTags.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                      on
                        ? "border-transparent text-white"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                    style={on ? { backgroundColor: t.color ?? "#16a34a" } : undefined}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No meals match.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((m) => {
                const added = addedCount[m.id] ?? 0;
                const loading = pendingId === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => pick(m.id)}
                      disabled={isPending}
                      className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left hover:border-border hover:bg-muted disabled:opacity-60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        {m.kcal != null && (
                          <p className="text-xs text-muted-foreground">
                            {Math.round(m.kcal)} kcal
                          </p>
                        )}
                      </div>
                      {added > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <Check className="size-3.5" />
                          {added > 1 ? `×${added}` : "Added"}
                        </span>
                      )}
                      {loading ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Plus className="size-4 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-3">
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
