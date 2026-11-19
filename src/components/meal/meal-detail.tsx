"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown, ChevronLeft, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { addDaysKey } from "@/lib/dates";
import { deleteMessage } from "@/lib/format";
import type { Macros } from "@/lib/macros";
import { MACROS_UI, fmtG, fmtKcal } from "@/lib/macro-format";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { tagStyle } from "@/lib/tag-colors";
import { MacroBadge } from "@/components/macro-ui";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { Sheet } from "@/components/ui/sheet";
import { FlowScreen } from "@/components/add/flow-screen";
import { useToast } from "@/components/toast";
import { ShareMealButton } from "@/components/share-meal-button";
import { addPlanEntryAction } from "@/app/(app)/plan/actions";
import { removeEntriesAction } from "@/app/(app)/today/actions";
import { deleteMealAction, mealUpcomingCountAction, setMealFavoriteAction } from "@/app/(app)/meals/actions";

export type DetailMeal = {
  id: string;
  name: string;
  favorite: boolean;
  servingLabel: string | null;
  serves: number;
  cookedGrams: number | null;
  prepSteps: string | null;
  macros: Macros;
  hasMacros: boolean;
  ingredients: { id: string; name: string; qty: number | null; unit: string | null; note: string | null }[];
  tags: { id: string; name: string; color: string | null }[];
  shareCode: string | null;
  imports: number;
};

const noun = (label: string | null) => label?.trim().replace(/^1\s+/, "") || "serving";
const plural = (n: number, w: string) => (Math.abs(n - 1) < 1e-9 ? w : w === "serving" ? "servings" : `${w}s`);

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDaysKey(today, 1)) return "Tomorrow";
  return format(parseISO(date), "EEE d");
}

/**
 * /meals/:id — the meal at a glance (per serving), log it by servings or by
 * weighing a portion of the cooked pot, plan it for another day, share it.
 */
export function MealDetail({
  meal,
  today,
  slot: initialSlot,
  imported,
  last,
}: {
  meal: DetailMeal;
  today: string;
  slot: SlotKey;
  imported: boolean;
  last: { servings: number; grams: number | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const n = noun(meal.servingLabel);
  const canWeigh = meal.cookedGrams != null && meal.cookedGrams > 0;
  const gramsPerServing = canWeigh ? meal.cookedGrams! / meal.serves : null;

  const [mode, setMode] = useState<"servings" | "weigh">(canWeigh && last?.grams ? "weigh" : "servings");
  const [servingsStr, setServingsStr] = useState(String(last && !last.grams ? last.servings : 1));
  const [gramsStr, setGramsStr] = useState(String(Math.round(last?.grams ?? gramsPerServing ?? 0)));
  const [slot, setSlot] = useState<SlotKey>(initialSlot);
  const [favorite, setFavorite] = useState(meal.favorite);
  const [planning, setPlanning] = useState(false);
  const [busy, startBusy] = useTransition();
  const [deleting, startDelete] = useTransition();

  const g = parseDecimal(gramsStr);
  const s = parseDecimal(servingsStr);
  const amount =
    mode === "weigh" && gramsPerServing
      ? Number.isFinite(g) && g > 0
        ? { servings: g / gramsPerServing, grams: Math.round(g) }
        : null
      : Number.isFinite(s) && s > 0
        ? { servings: s, grams: null }
        : null;
  const scaled = (k: keyof Macros) => (amount ? meal.macros[k] * amount.servings : 0);
  const amountLabel = amount
    ? amount.grams != null
      ? `${fmtG(amount.grams)} g`
      : `${fmtG(amount.servings)} ${plural(amount.servings, n)}`
    : "";

  // Stacked bar: each macro's share of the calories.
  const pK = meal.macros.protein * 4;
  const cK = meal.macros.carbs * 4;
  const fK = meal.macros.fat * 9;
  const totalK = pK + cK + fK || 1;

  function log(date: string, planSlot: SlotKey, eaten: boolean) {
    if (!amount) return;
    startBusy(async () => {
      const res = await addPlanEntryAction(
        { date, slot: planSlot, mealId: meal.id, servings: amount.servings, grams: amount.grams },
        { eaten },
      );
      if (!res.ok) {
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      setPlanning(false);
      toast.undoable({
        message: eaten
          ? `Logged ${amountLabel} to ${SLOT_LABELS[planSlot]} · ${fmtKcal(scaled("kcal"))} kcal`
          : `Planned for ${dayLabel(date, today)} · ${SLOT_LABELS[planSlot]}`,
        commit: () => {},
        undo: () => void removeEntriesAction([res.id]),
      });
    });
  }

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    void setMealFavoriteAction(meal.id, next);
  }

  function remove() {
    startDelete(async () => {
      const upcoming = await mealUpcomingCountAction(meal.id);
      if (!confirm(deleteMessage(`“${meal.name}”`, upcoming))) return;
      const res = await deleteMealAction(meal.id);
      if (res && !res.ok) toast.show({ message: res.error, tone: "error" });
    });
  }

  const steps = (meal.prepSteps ?? "")
    .split(/\n+/)
    .map((x) => x.replace(/^\s*(step\s*)?\d+[.):]\s*/i, "").trim())
    .filter(Boolean);

  return (
    <FlowScreen
      top={
        <div className="flex items-center gap-1 pb-2">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="-ml-2 grid size-11 place-items-center rounded-full">
            <ChevronLeft className="size-6" />
          </button>
          <span className="flex-1" />
          <button type="button" onClick={toggleFavorite} aria-pressed={favorite} aria-label={favorite ? "Unstar meal" : "Star meal"} className="grid size-11 place-items-center rounded-full">
            <Star className={cn("size-5", favorite && "fill-ink")} />
          </button>
          <ShareMealButton mealId={meal.id} mealName={meal.name} initialCode={meal.shareCode} imports={meal.imports} />
          <Link href={`/meals/${meal.id}/edit`} aria-label="Edit meal" className="-mr-2 grid size-11 place-items-center rounded-full">
            <Pencil className="size-5" />
          </Link>
        </div>
      }
      bottom={
        <div className="flex gap-2.5">
          <Button type="button" variant="secondary" size="lg" className="w-[34%]" onClick={() => setPlanning(true)} disabled={!amount}>
            Plan…
          </Button>
          <Button type="button" size="lg" className="flex-1" disabled={!amount || busy} onClick={() => log(today, slot, true)}>
            {busy && !planning && <Loader2 className="animate-spin" />}
            Log {amountLabel} to {SLOT_LABELS[slot]}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-8">
        <div>
          <h1 className="t-title">{meal.name}</h1>
          {meal.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {meal.tags.map((t) => (
                <span key={t.id} className="tag" style={tagStyle(t.color)}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {imported && (
          <p className="flex items-center gap-2 rounded-[14px] bg-good/10 p-3 text-sm font-semibold text-good">
            <Check className="size-4 shrink-0" /> Imported. This copy is yours to edit and plan.
          </p>
        )}

        {meal.hasMacros ? (
          <section className="card p-4" aria-label="Macros per serving">
            <p className="flex items-baseline gap-2">
              <span className="num text-[44px] font-semibold leading-none">{fmtKcal(meal.macros.kcal)}</span>
              <span className="text-sm text-ink-2">
                kcal per {n}
                {meal.serves > 1 ? ` · ${fmtG(meal.serves)} ${plural(meal.serves, n)}` : ""}
              </span>
            </p>
            <div className="mt-3 flex h-2.5 gap-[3px] overflow-hidden rounded-full" aria-hidden>
              <i className="block rounded-full bg-pro" style={{ width: `${(pK / totalK) * 100}%` }} />
              <i className="block rounded-full bg-carb" style={{ width: `${(cK / totalK) * 100}%` }} />
              <i className="block rounded-full bg-fat" style={{ width: `${(fK / totalK) * 100}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {MACROS_UI.map((m) => (
                <div key={m.key} className="flex flex-col items-start gap-1">
                  <MacroBadge macro={m.key} />
                  <span className="num text-lg font-semibold leading-none">{fmtG(meal.macros[m.key])}</span>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="card p-4 text-sm text-ink-3">No macros yet. Edit the meal to add ingredients or enter them by hand.</p>
        )}

        <section className="card flex flex-col gap-3 p-4" aria-label="Amount">
          {canWeigh && (
            <div className="seg w-full" role="radiogroup" aria-label="Log by">
              <button type="button" role="radio" aria-checked={mode === "servings"} className={cn("flex-1", mode === "servings" && "on")} onClick={() => setMode("servings")}>
                Servings
              </button>
              <button type="button" role="radio" aria-checked={mode === "weigh"} className={cn("flex-1", mode === "weigh" && "on")} onClick={() => setMode("weigh")}>
                Weigh portion
              </button>
            </div>
          )}
          {mode === "weigh" && gramsPerServing ? (
            <div className="flex items-center gap-3">
              <span className="relative w-32 shrink-0">
                <input
                  inputMode="decimal"
                  aria-label="Grams on the plate"
                  value={gramsStr}
                  onChange={(e) => setGramsStr(e.target.value)}
                  className="num h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface pl-3.5 pr-8 text-[17px] font-semibold outline-none focus:border-2 focus:border-ink"
                />
                <span className="pointer-events-none absolute right-3 top-0 flex h-[52px] items-center text-sm text-ink-3">g</span>
              </span>
              <p className="min-w-0 text-sm leading-snug">
                <span className="text-ink-2">of the {fmtKcal(meal.cookedGrams!)} g pot</span>
                <br />
                {amount && (
                  <b>
                    {fmtG(amount.servings)} {plural(amount.servings, n)} · {fmtKcal(scaled("kcal"))} kcal · {fmtG(scaled("protein"))} P
                  </b>
                )}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Stepper value={servingsStr} onChange={setServingsStr} step={0.5} min={0.5} label={`${n}s`} className="w-40 shrink-0" />
              <p className="min-w-0 text-sm font-semibold">
                {amount && `${fmtKcal(scaled("kcal"))} kcal · ${fmtG(scaled("protein"))} P`}
              </p>
            </div>
          )}
          <label className="relative flex h-11 items-center gap-1 self-start text-sm text-ink-2">
            Adding to <b className="text-ink">{SLOT_LABELS[slot]}</b> <ChevronDown className="size-4" />
            <select value={slot} onChange={(e) => setSlot(e.target.value as SlotKey)} aria-label="Slot" className="absolute inset-0 cursor-pointer opacity-0">
              {SLOTS.map((x) => (
                <option key={x} value={x}>
                  {SLOT_LABELS[x]}
                </option>
              ))}
            </select>
          </label>
        </section>

        {meal.ingredients.length > 0 && (
          <section aria-label="Ingredients">
            <h2 className="t-cap mb-1">Ingredients · {meal.serves > 1 ? "whole pot" : `per ${n}`}</h2>
            <ul className="divide-y divide-line">
              {meal.ingredients.map((i) => (
                <li key={i.id} className="flex min-h-12 items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    {i.name}
                    {i.note && <span className="text-ink-3"> · {i.note}</span>}
                  </span>
                  {i.qty != null && (
                    <span className="num shrink-0 text-ink-2">
                      {fmtG(i.qty)} {i.unit ?? ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {steps.length > 0 && (
          <section aria-label="Prep steps">
            <h2 className="t-cap mb-2">Prep steps</h2>
            <ol className="flex flex-col gap-3">
              {steps.map((st, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
                  <span className="leading-relaxed">{st}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <button type="button" onClick={remove} disabled={deleting} className="flex h-11 items-center gap-2 self-start text-sm font-semibold text-bad">
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete meal
        </button>
      </div>

      {planning && amount && (
        <PlanSheet
          today={today}
          initialSlot={slot}
          summary={`${amountLabel} · ${fmtKcal(scaled("kcal"))} kcal`}
          busy={busy}
          onPlan={(date, s2) => log(date, s2, false)}
          onClose={() => setPlanning(false)}
        />
      )}
    </FlowScreen>
  );
}

/** "Plan…": pick a day in the next two weeks and a slot. */
function PlanSheet({
  today,
  initialSlot,
  summary,
  busy,
  onPlan,
  onClose,
}: {
  today: string;
  initialSlot: SlotKey;
  summary: string;
  busy: boolean;
  onPlan: (date: string, slot: SlotKey) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(addDaysKey(today, 1));
  const [slot, setSlot] = useState(initialSlot);
  const days = Array.from({ length: 14 }, (_, i) => addDaysKey(today, i));
  return (
    <Sheet label="Plan this meal" onClose={onClose}>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div>
          <h2 className="t-h2">Plan</h2>
          <p className="text-sm text-ink-3">{summary}</p>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Day">
          {days.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={date === d} onClick={() => setDate(d)} className={cn("chip sm shrink-0", date === d && "on")}>
              {dayLabel(d, today)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Slot">
          {SLOTS.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={slot === x} onClick={() => setSlot(x)} className={cn("chip sm", slot === x && "on")}>
              {SLOT_LABELS[x]}
            </button>
          ))}
        </div>
        <Button type="button" size="lg" disabled={busy} onClick={() => onPlan(date, slot)}>
          {busy && <Loader2 className="animate-spin" />} Add to {dayLabel(date, today)} · {SLOT_LABELS[slot]}
        </Button>
      </div>
    </Sheet>
  );
}
