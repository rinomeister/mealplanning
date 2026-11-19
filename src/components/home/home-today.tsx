"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MACROS_UI, fmtG, fmtKcal, type DayTotals, type GramMacro, type Targets } from "@/lib/macro-format";
import { SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { KcalRing, MacroBadge, MacroBar, barState } from "@/components/macro-ui";
import { useToast } from "@/components/toast";
import { openAddSheet } from "@/components/add/add-sheet";
import { addPlanEntryAction } from "@/app/(app)/plan/actions";
import {
  logExistingProductAction,
  markSlotEatenAction,
  removeEntriesAction,
  setEntriesStatusAction,
  type RecentItem,
} from "@/app/(app)/today/actions";

export type NextUp = { slot: SlotKey; names: string[]; kcal: number };

/** One macro as a full-width row: badge, name, eaten / target, what's left, bar. */
function MacroRow({
  macro,
  eaten,
  planned,
  target,
}: {
  macro: GramMacro;
  eaten: number;
  planned: number;
  target: number | null;
}) {
  const m = MACROS_UI.find((x) => x.key === macro)!;
  const state = barState(macro, eaten, target);
  const hero = macro === "protein";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <MacroBadge macro={macro} className="self-center" />
        <span className={cn("font-semibold", hero ? "text-[15px]" : "text-sm")}>{m.label}</span>
        <span className="ml-auto num">
          <span className={cn("font-semibold", hero ? "text-[17px]" : "text-[15px]", state === "over" && "text-bad")}>
            {fmtG(eaten)}
          </span>
          <span className="text-sm text-ink-3">{target != null ? ` / ${fmtG(target)} g` : " g"}</span>
        </span>
        <span
          className={cn(
            "w-[78px] shrink-0 text-right text-[13px] font-semibold",
            state === "over" ? "text-bad" : state === "hit" ? "text-good" : "text-ink-2",
          )}
        >
          {state === "hit" ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" /> hit
            </span>
          ) : state === "over" && target != null ? (
            `+${fmtG(eaten - target)} over`
          ) : target != null ? (
            `${fmtG(target - eaten)} left`
          ) : null}
        </span>
      </div>
      <MacroBar macro={macro} eaten={eaten} planned={planned} target={target} size={hero ? "lg" : "md"} />
    </div>
  );
}

/**
 * Today at a glance — the most important card, so it gets the big ring and a
 * full-width bar for every macro. Tapping the totals opens Today; the Next row
 * can mark the coming slot eaten in place.
 */
export function HomeTodayCard({
  date,
  slot,
  totals,
  targets,
  next,
}: {
  date: string;
  slot: SlotKey;
  totals: DayTotals;
  targets: Targets;
  next: NextUp | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { eaten, planned } = totals;
  const kt = targets.kcal;

  async function markEaten() {
    if (!next) return;
    setBusy(true);
    const res = await markSlotEatenAction(date, next.slot);
    setBusy(false);
    if (!res.ok) {
      toast.show({ message: res.error, tone: "error" });
      return;
    }
    router.refresh();
    toast.undoable({
      message: `${SLOT_LABELS[next.slot]} marked eaten`,
      commit: () => {},
      undo: () => void setEntriesStatusAction(res.ids, "PLANNED").then(() => router.refresh()),
    });
  }

  // Nothing eaten or planned yet: say what fills this card, and how.
  if (eaten.kcal === 0 && planned.kcal === 0 && !next) {
    return (
      <section className="card flex flex-col gap-4 p-4" aria-label="Today">
        <div className="flex items-center gap-4">
          <KcalRing eaten={0} planned={0} target={kt} size={96} stroke={10} compactLabel />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold">Nothing logged today</p>
            <p className="mt-0.5 text-sm text-ink-2">
              {kt != null ? "Your targets are set. Add your first food and this fills in." : "Add your first food and this fills in. Set targets in Me to see what's left."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAddSheet(router, pathname, new URLSearchParams(window.location.search), slot)}
          className="press flex h-12 items-center justify-center gap-2 rounded-btn bg-ink font-semibold text-inv"
        >
          <Plus className="size-5" /> Log food
        </button>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4 p-4" aria-label="Today">
      <Link href="/today" className="flex flex-col gap-4" aria-label="Open Today">
        <div className="flex items-center gap-4">
          <KcalRing eaten={eaten.kcal} planned={planned.kcal} target={kt} size={148} stroke={14} compactLabel />
          <div className="min-w-0 flex-1">
            <p className="t-cap mb-1">Eaten</p>
            <p className="num text-[30px] font-semibold leading-none">{fmtKcal(eaten.kcal)}</p>
            <p className="mt-1 text-sm text-ink-2">{kt != null ? `of ${fmtKcal(kt)} kcal` : "kcal"}</p>
            {planned.kcal > 0 && (
              <p className="mt-2 text-[13px] text-ink-3">+ {fmtKcal(planned.kcal)} planned</p>
            )}
            {kt == null && <p className="mt-2 text-[13px] text-ink-3">Set a calorie target in Me to see what&apos;s left.</p>}
          </div>
          <ChevronRight className="size-5 shrink-0 self-start text-ink-3" aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          {MACROS_UI.map((m) => (
            <MacroRow
              key={m.key}
              macro={m.key}
              eaten={eaten[m.key]}
              planned={planned[m.key]}
              target={targets[m.key]}
            />
          ))}
        </div>
      </Link>

      <div className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-surface-2 py-1.5 pl-3 pr-1.5">
        <span className="text-xs font-bold tracking-[.05em] text-ink-3">NEXT</span>
        {next ? (
          <>
            <Link href="/today" className="flex min-w-0 flex-1 flex-col text-sm leading-tight">
              <b className="truncate">
                {SLOT_LABELS[next.slot]} · {fmtKcal(next.kcal)} kcal
              </b>
              <span className="truncate text-ink-2">{next.names.join(", ")}</span>
            </Link>
            <button
              type="button"
              onClick={() => void markEaten()}
              disabled={busy}
              className="press flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-ink px-3 text-[13px] font-semibold text-inv"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Mark eaten
            </button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-2">Nothing planned for later today</span>
            <button
              type="button"
              onClick={() => openAddSheet(router, pathname, new URLSearchParams(window.location.search), slot)}
              className="press flex h-9 shrink-0 items-center gap-1 rounded-[10px] bg-surface px-3 text-[13px] font-semibold"
            >
              <Plus className="size-4" /> Add
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** "Log again": the last few things, at their last amount, into the current slot. */
export function LogAgain({ date, slot, items }: { date: string; slot: SlotKey; items: RecentItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function add(r: RecentItem) {
    const key = `${r.kind}${r.id}`;
    setPending(key);
    startTransition(async () => {
      const res =
        r.kind === "product"
          ? await logExistingProductAction({ date, slot, productId: r.id, grams: r.grams ?? 100 }, { eaten: true })
          : await addPlanEntryAction({ date, slot, mealId: r.id, servings: r.servings, grams: r.grams }, { eaten: true });
      setPending(null);
      if (!res.ok) {
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      router.refresh();
      toast.undoable({
        message: `Added to ${SLOT_LABELS[slot]} · ${fmtKcal(r.kcal)} kcal`,
        commit: () => {},
        undo: () => void removeEntriesAction([res.id]).then(() => router.refresh()),
      });
    });
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Log again">
      <h2 className="t-cap">Log again · to {SLOT_LABELS[slot]}</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] desk:mx-0 desk:flex-wrap desk:overflow-visible desk:px-0">
        {items.map((r) => {
          const key = `${r.kind}${r.id}`;
          return (
            <button
              key={key}
              type="button"
              onClick={() => add(r)}
              disabled={pending === key}
              className="chip h-12 shrink-0 gap-2"
              aria-label={`Add ${r.amount} of ${r.name} to ${SLOT_LABELS[slot]}`}
            >
              {pending === key ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              <span className="flex flex-col items-start leading-tight">
                <span className="max-w-[180px] truncate text-sm font-semibold">{r.name}</span>
                <span className="max-w-[180px] truncate text-xs text-ink-3">
                  {r.amount.split(" · ")[0]} · {fmtKcal(r.kcal)} · {fmtG(r.protein)} P
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
