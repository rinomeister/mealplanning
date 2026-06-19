"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
    const n = Number(servings);
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

export function AddMealControl({
  date,
  slot,
  meals,
}: {
  date: string;
  slot: string;
  meals: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [mealId, setMealId] = useState("");
  const [servings, setServings] = useState("1");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (meals.length === 0) {
    return (
      <Link href="/meals/new" className="text-xs text-primary hover:underline">
        + Create a meal first
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="size-3.5" /> Add meal
      </button>
    );
  }

  function add() {
    if (!mealId) {
      setError("Pick a meal.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addPlanEntryAction({ date, slot, mealId, servings });
      if (res.ok) {
        setOpen(false);
        setMealId("");
        setServings("1");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select
          value={mealId}
          onChange={(e) => setMealId(e.target.value)}
          className="h-8 flex-1 text-xs"
        >
          <option value="">Select meal…</option>
          {meals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Input
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          inputMode="decimal"
          className="h-8 w-14 text-center text-xs"
          aria-label="Servings"
        />
        <Button type="button" size="sm" onClick={add} disabled={isPending} className="h-8">
          {isPending ? <Loader2 className="animate-spin" /> : "Add"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          className="h-8"
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
