"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, MoreHorizontal, Plus, Soup } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { formatHuman } from "@/lib/dates";
import { addMacros, ZERO_MACROS, type Macros } from "@/lib/macros";
import { fmtG, fmtKcal, macrosOf, sumByStatus, type Targets } from "@/lib/macro-format";
import type { DayEntry } from "@/lib/day-entry";
import { MacroDot, MacroStrip, MacroSummaryFull } from "@/components/macro-ui";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/ui/modal";
import { SaveSlotMealForm } from "@/components/save-slot-meal";
import { AddFoodTiles } from "@/components/day-tracker";
import { EntryRow, withAmount } from "@/components/today/entry-row";
import { EntryMenu, SlotMenu } from "@/components/today/today-menus";
import {
  setEntryStatusAction,
  setServingsAction,
  addPlanEntryAction,
} from "@/app/(app)/plan/actions";
import {
  copyDayAction,
  copyEntryToDateAction,
  copySlotFromDateAction,
  markSlotEatenAction,
  moveEntryAction,
  removeEntriesAction,
  setEntriesStatusAction,
  setGramsAction,
} from "@/app/(app)/today/actions";

export type Suggestion = { id: string; name: string; kcal: number | null; protein: number | null };
export type SlotPreview = { names: string[]; kcal: number };

type Op =
  | { type: "status"; ids: string[]; status: DayEntry["status"] }
  | { type: "amount"; id: string; value: number }
  | { type: "move"; id: string; slot: SlotKey };

function reduce(entries: DayEntry[], op: Op): DayEntry[] {
  switch (op.type) {
    case "status":
      return entries.map((e) => (op.ids.includes(e.id) ? { ...e, status: op.status } : e));
    case "amount":
      return entries.map((e) => (e.id === op.id ? withAmount(e, op.value) : e));
    case "move":
      return entries.map((e) => (e.id === op.id ? { ...e, slot: op.slot } : e));
  }
}

const entryMacros = (e: DayEntry) =>
  macrosOf({ ...e.basis, servings: e.servings, grams: e.grams, productId: e.productId });

function sumMacros(list: DayEntry[]): Macros {
  return list.reduce((acc, e) => addMacros(acc, entryMacros(e)), { ...ZERO_MACROS });
}

export function TodayView({
  date,
  logAsEaten,
  currentSlot,
  focusSlot,
  targets,
  entries,
  suggestions,
  yesterday,
}: {
  date: string;
  /** Today or earlier: things logged here are eaten, not planned. */
  logAsEaten: boolean;
  /** The slot that fits the time of day (today only). */
  currentSlot: SlotKey | null;
  /** Slot to open and scroll to, from "+" (?add=). */
  focusSlot: SlotKey | null;
  targets: Targets;
  entries: DayEntry[];
  suggestions: Suggestion[];
  yesterday: Partial<Record<SlotKey, SlotPreview>>;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [copying, startCopy] = useTransition();
  const [optimistic, apply] = useOptimistic(entries, reduce);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuEntryId, setMenuEntryId] = useState<string | null>(null);
  const [menuSlot, setMenuSlot] = useState<SlotKey | null>(null);
  const [saveSlot, setSaveSlot] = useState<SlotKey | null>(null);
  const [toggled, setToggled] = useState<Partial<Record<SlotKey, boolean>>>({});

  const visible = optimistic.filter((e) => !hidden.has(e.id));
  const { eaten, planned } = sumByStatus(
    visible.map((e) => ({ ...e.basis, status: e.status, servings: e.servings, grams: e.grams, productId: e.productId })),
  );

  // Announce new totals to screen readers after a change.
  const announcement = `${targets.kcal != null ? `${fmtKcal(Math.max(0, targets.kcal - eaten.kcal))} kcal left` : `${fmtKcal(eaten.kcal)} kcal eaten`}, ${fmtG(eaten.protein)} grams protein`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    toast.announce(announcement);
  }, [announcement, toast]);

  // --- Actions (optimistic first, server second) -------------------------

  function fail(retry: () => void) {
    toast.show({ message: "Couldn't save that change", tone: "error", action: { label: "Retry", onClick: retry } });
  }

  function setStatus(ids: string[], status: DayEntry["status"]) {
    startTransition(async () => {
      apply({ type: "status", ids, status });
      const res =
        ids.length === 1 ? await setEntryStatusAction(ids[0], status) : await setEntriesStatusAction(ids, status);
      if (!res.ok) fail(() => setStatus(ids, status));
    });
  }

  function toggleEaten(e: DayEntry) {
    setStatus([e.id], e.status === "EATEN" ? "PLANNED" : e.status === "SKIPPED" ? "PLANNED" : "EATEN");
  }

  function setAmount(e: DayEntry, value: number) {
    startTransition(async () => {
      apply({ type: "amount", id: e.id, value });
      const res = e.kind === "product" || e.gramsPerServing != null
        ? await setGramsAction(e.id, value)
        : await setServingsAction(e.id, value);
      if (!res.ok) fail(() => setAmount(e, value));
    });
  }

  function move(e: DayEntry, slot: SlotKey) {
    startTransition(async () => {
      apply({ type: "move", id: e.id, slot });
      const res = await moveEntryAction(e.id, slot);
      if (res.ok) toast.show({ message: `Moved to ${SLOT_LABELS[slot]}` });
      else fail(() => move(e, slot));
    });
  }

  /** Hide now; delete when the Undo toast runs out. */
  function removeWithUndo(ids: string[], message: string) {
    setHidden((h) => new Set([...h, ...ids]));
    toast.undoable({
      message,
      commit: () => {
        startTransition(async () => {
          const res = await removeEntriesAction(ids);
          if (!res.ok) {
            setHidden((h) => new Set([...h].filter((x) => !ids.includes(x))));
            toast.show({ message: "Couldn't remove that", tone: "error" });
          }
        });
      },
      undo: () => setHidden((h) => new Set([...h].filter((x) => !ids.includes(x)))),
    });
  }

  function copyEntry(e: DayEntry, to: string) {
    startTransition(async () => {
      const res = await copyEntryToDateAction(e.id, to);
      if (res.ok) toast.show({ message: `Copied to ${formatHuman(to)}` });
      else toast.show({ message: res.error, tone: "error" });
    });
  }

  function sameAsYesterday(slot: SlotKey) {
    startTransition(async () => {
      const res = await copySlotFromDateAction({ fromDate: yesterdayKey(date), toDate: date, slot });
      if (!res.ok) {
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      toast.undoable({
        message: `Added ${res.count} from yesterday`,
        commit: () => {},
        undo: () => startTransition(async () => void (await removeEntriesAction(res.ids))),
      });
    });
  }

  /** Empty day: bring all of yesterday back (as planned), with Undo. */
  function copyYesterday() {
    startCopy(async () => {
      const res = await copyDayAction({ fromDate: yesterdayKey(date), toDate: date });
      if (!res.ok) {
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      toast.undoable({
        message: `Copied ${res.count} from yesterday`,
        commit: () => {},
        undo: () => startTransition(async () => void (await removeEntriesAction(res.ids))),
      });
    });
  }

  function copySlotTo(slot: SlotKey, to: string) {
    startTransition(async () => {
      const res = await copySlotFromDateAction({ fromDate: date, toDate: to, slot });
      toast.show(res.ok ? { message: `Copied ${SLOT_LABELS[slot]} to ${formatHuman(to)}` } : { message: res.error, tone: "error" });
    });
  }

  function markAllEaten(slot: SlotKey) {
    const ids = visible.filter((e) => e.slot === slot && e.status === "PLANNED").map((e) => e.id);
    startTransition(async () => {
      apply({ type: "status", ids, status: "EATEN" });
      const res = await markSlotEatenAction(date, slot);
      if (!res.ok) {
        fail(() => markAllEaten(slot));
        return;
      }
      toast.undoable({
        message: `${SLOT_LABELS[slot]} marked eaten`,
        commit: () => {},
        undo: () => startTransition(async () => void (await setEntriesStatusAction(res.ids, "PLANNED"))),
      });
    });
  }

  function addSuggestion(s: Suggestion) {
    const slot = currentSlot ?? "SNACK_1";
    startTransition(async () => {
      const res = await addPlanEntryAction({ date, slot, mealId: s.id, servings: 1 }, { eaten: logAsEaten });
      if (!res.ok) {
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      toast.undoable({
        message: `Added to ${SLOT_LABELS[slot]} · ${fmtKcal(s.kcal ?? 0)} kcal`,
        commit: () => {},
        undo: () => startTransition(async () => void (await removeEntriesAction([res.id]))),
      });
    });
  }

  // --- Layout ----------------------------------------------------------------

  const slots = SLOTS.map((slot) => {
    const list = visible.filter((e) => e.slot === slot);
    const counted = list.filter((e) => e.status !== "SKIPPED");
    const allEaten = counted.length > 0 && counted.every((e) => e.status === "EATEN");
    const autoOpen = slot === currentSlot || slot === focusSlot;
    const open = toggled[slot] ?? autoOpen;
    return {
      slot,
      list,
      counted,
      allEaten,
      hasPlanned: counted.some((e) => e.status === "PLANNED"),
      totals: sumMacros(counted),
      open,
      isNow: slot === currentSlot,
    };
  });

  // Consecutive collapsed slots share one card, as in the design.
  const groups: (typeof slots)[] = [];
  for (const s of slots) {
    const last = groups[groups.length - 1];
    if (!s.open && last && !last[0].open) last.push(s);
    else groups.push([s]);
  }

  const menuEntry = visible.find((e) => e.id === menuEntryId) ?? null;
  const menuSlotInfo = slots.find((s) => s.slot === menuSlot) ?? null;
  const uncounted = visible.filter((e) => e.status !== "SKIPPED" && !e.hasMacros).length;

  // Scroll the slot "+" asked for into view.
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusSlot) focusRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusSlot]);

  return (
    <>
      {/* Desktop: totals and suggestions stay put on the left; slots scroll on the right. */}
      <div className="desk:grid desk:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desk:items-start desk:gap-6">
      <div className="desk:sticky desk:top-0">
      <SummaryWithStrip eaten={eaten} planned={planned} targets={targets} />
      {uncounted > 0 && (
        <p className="mt-2 text-sm text-ink-3">
          {uncounted} item{uncounted === 1 ? " has" : "s have"} no macros and {uncounted === 1 ? "isn't" : "aren't"} counted.
        </p>
      )}

      {suggestions.length > 0 && (
        <section className="mt-5" aria-labelledby="fits-heading">
          <h2 id="fits-heading" className="t-cap mb-2">
            Fits what&apos;s left
          </h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] desk:mx-0 desk:flex-col desk:overflow-visible desk:px-0">
            {suggestions.map((s) => (
              <div key={s.id} className="flex min-w-44 shrink-0 items-center gap-2 rounded-btn border border-line bg-surface py-2 pl-4 pr-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="text-[13px] text-ink-3">
                    {fmtKcal(s.kcal ?? 0)} kcal{s.protein != null && ` · ${fmtG(s.protein)} P`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addSuggestion(s)}
                  className="press grid size-11 shrink-0 place-items-center rounded-[14px]"
                  aria-label={`Add ${s.name} to ${SLOT_LABELS[currentSlot ?? "SNACK_1"]}`}
                >
                  <Plus className="size-5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
      <div>

      {visible.length === 0 ? (
        <EmptyDay
          date={date}
          slot={currentSlot ?? "BREAKFAST"}
          yesterdayKcal={Object.values(yesterday).reduce((sum, p) => sum + (p?.kcal ?? 0), 0)}
          copying={copying}
          onCopyYesterday={copyYesterday}
        />
      ) : (
      <div className="mt-5 flex flex-col gap-3 desk:mt-0">
        {groups.map((group) =>
          group[0].open ? (
            group.map((s) => (
              <section
                key={s.slot}
                ref={s.slot === focusSlot ? focusRef : undefined}
                aria-label={SLOT_LABELS[s.slot]}
                className={cn(
                  "scroll-mt-24 rounded-card bg-surface px-4 pb-4 pt-3 shadow-card",
                  s.isNow ? "border-2 border-ink" : "border border-line",
                )}
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-semibold">{SLOT_LABELS[s.slot]}</h2>
                  {s.isNow && <span className="tag bg-surface-2 text-ink">Now</span>}
                  {s.counted.length > 0 && (
                    <span className="ml-1 text-sm text-ink-3">
                      <span className="num font-semibold text-ink">{fmtKcal(s.totals.kcal)}</span> kcal
                    </span>
                  )}
                  <div className="ml-auto flex items-center">
                    {!s.isNow && (
                      <button
                        type="button"
                        onClick={() => setToggled((t) => ({ ...t, [s.slot]: false }))}
                        className="grid size-11 place-items-center rounded-[14px] text-ink-2"
                        aria-label={`Collapse ${SLOT_LABELS[s.slot]}`}
                        aria-expanded
                      >
                        <ChevronDown className="size-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMenuSlot(s.slot)}
                      className="-mr-2 grid size-11 place-items-center rounded-[14px] text-ink"
                      aria-label={`${SLOT_LABELS[s.slot]} options`}
                    >
                      <MoreHorizontal className="size-5" />
                    </button>
                  </div>
                </div>
                {s.list.length > 0 && (
                  <div className="mb-3 divide-y divide-line">
                    {s.list.map((e) => (
                      <EntryRow
                        key={e.id}
                        entry={e}
                        editing={editingId === e.id}
                        onEdit={(on) => setEditingId(on ? e.id : null)}
                        onToggleEaten={() => toggleEaten(e)}
                        onCommitAmount={(v) => setAmount(e, v)}
                        onOpenMenu={() => setMenuEntryId(e.id)}
                      />
                    ))}
                  </div>
                )}
                {s.list.length === 0 && <p className="mb-3 mt-1 text-sm text-ink-3">Nothing here yet.</p>}
                <AddFoodTiles date={date} slot={s.slot} />
              </section>
            ))
          ) : (
            <div key={group[0].slot} className="divide-y divide-line rounded-card border border-line bg-surface px-4 shadow-card">
              {group.map((s) => (
                <button
                  key={s.slot}
                  type="button"
                  onClick={() => setToggled((t) => ({ ...t, [s.slot]: true }))}
                  aria-expanded={false}
                  className="flex min-h-[64px] w-full items-center gap-3 py-2.5 text-left"
                >
                  <span
                    className={cn("check", s.allEaten && "done", s.list.length === 0 && "opacity-40")}
                    aria-hidden
                  >
                    {s.allEaten && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-semibold">{SLOT_LABELS[s.slot]}</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {s.counted.length === 0
                        ? "Nothing yet"
                        : `${s.hasPlanned && !s.counted.some((e) => e.status === "EATEN") ? "Planned · " : ""}${s.counted.map((e) => e.name).join(", ")}`}
                    </span>
                  </span>
                  {s.counted.length > 0 && (
                    <span className="shrink-0 text-right">
                      <span className="num block font-semibold">{fmtKcal(s.totals.kcal)}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
                        <MacroDot macro="protein" />
                        <span className="num">{fmtG(s.totals.protein)}</span>
                      </span>
                    </span>
                  )}
                  <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                </button>
              ))}
            </div>
          ),
        )}
      </div>
      )}
      </div>
      </div>

      {menuEntry && (
        <EntryMenu
          date={date}
          entry={menuEntry}
          onClose={() => setMenuEntryId(null)}
          onStatus={(st) => setStatus([menuEntry.id], st)}
          onChangeAmount={() => setEditingId(menuEntry.id)}
          onMove={(slot) => move(menuEntry, slot)}
          onCopy={(d) => copyEntry(menuEntry, d)}
          onRemove={() => removeWithUndo([menuEntry.id], `Removed ${menuEntry.name}`)}
        />
      )}
      {menuSlotInfo && (
        <SlotMenu
          date={date}
          slot={menuSlotInfo.slot}
          totals={menuSlotInfo.totals}
          hasEntries={menuSlotInfo.counted.length > 0}
          hasPlanned={menuSlotInfo.hasPlanned}
          yesterday={yesterday[menuSlotInfo.slot]}
          onClose={() => setMenuSlot(null)}
          onSameAsYesterday={() => sameAsYesterday(menuSlotInfo.slot)}
          onCopyTo={(d) => copySlotTo(menuSlotInfo.slot, d)}
          onSaveAsMeal={() => setSaveSlot(menuSlotInfo.slot)}
          onMarkAllEaten={() => markAllEaten(menuSlotInfo.slot)}
          onClear={() =>
            removeWithUndo(
              menuSlotInfo.list.map((e) => e.id),
              `Cleared ${SLOT_LABELS[menuSlotInfo.slot]}`,
            )
          }
        />
      )}
      {saveSlot && (
        <Modal onClose={() => setSaveSlot(null)} label={`Save ${SLOT_LABELS[saveSlot]} as a meal`}>
          <div className="p-5">
            <p className="t-h2 mb-4">Save {SLOT_LABELS[saveSlot]} as meal</p>
            <SaveSlotMealForm date={date} slot={saveSlot} slotLabel={SLOT_LABELS[saveSlot]} onDone={() => setSaveSlot(null)} />
          </div>
        </Modal>
      )}
    </>
  );
}

function yesterdayKey(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The full summary card; once it scrolls away, the compact strip pins to the
 * top of the scroll area.
 */
function SummaryWithStrip({
  eaten,
  planned,
  targets,
}: {
  eaten: Macros;
  planned: Macros;
  targets: Targets;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting), {
      root: document.getElementById("app-scroll"),
      threshold: 0,
      rootMargin: "-40px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const data = useMemo(() => ({ eaten, planned, targets }), [eaten, planned, targets]);

  return (
    <>
      <div className="sticky top-0 z-20 h-0">
        <div
          aria-hidden={!pinned}
          className={cn(
            "-mx-1 rounded-b-card border border-t-0 border-line bg-surface px-4 py-3 shadow-card transition-[opacity,transform] duration-200",
            pinned ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
          )}
        >
          <MacroStrip {...data} />
        </div>
      </div>
      <div ref={ref} className="rounded-card border border-line bg-surface p-4 shadow-card">
        <MacroSummaryFull {...data} />
      </div>
    </>
  );
}

function EmptyDay({
  date,
  slot,
  yesterdayKcal,
  copying,
  onCopyYesterday,
}: {
  date: string;
  slot: SlotKey;
  yesterdayKcal: number;
  copying: boolean;
  onCopyYesterday: () => void;
}) {
  return (
    <section className="card mt-5 flex flex-col items-center gap-3 px-4 pb-4 pt-6 text-center desk:mt-0" aria-label="Nothing logged yet">
      <span className="grid size-12 place-items-center rounded-[14px] bg-surface-2 text-ink-2">
        <Soup className="size-5" />
      </span>
      <div>
        <p className="text-[17px] font-semibold">Nothing logged yet</p>
        <p className="mt-1 text-sm text-ink-2">
          Start with {SLOT_LABELS[slot].toLowerCase()}
          {yesterdayKcal > 0 ? ", or bring back yesterday in one tap." : "."}
        </p>
      </div>
      {yesterdayKcal > 0 && (
        <button
          type="button"
          onClick={onCopyYesterday}
          disabled={copying}
          className="press flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-ink font-semibold text-inv"
        >
          {copying && <Loader2 className="size-4 animate-spin" />}
          Copy yesterday · {fmtKcal(yesterdayKcal)} kcal
        </button>
      )}
      <div className="w-full">
        <AddFoodTiles date={date} slot={slot} />
      </div>
    </section>
  );
}
