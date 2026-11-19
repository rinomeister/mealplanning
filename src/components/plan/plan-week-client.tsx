"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey } from "@/lib/dates";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/toast";
import { openAddSheet } from "@/components/add/add-sheet";
import { copyDayToDatesAction, copyWeekAction } from "@/app/(app)/plan/actions";
import { removeEntriesAction } from "@/app/(app)/today/actions";

/** "+" on a Plan slot: the Add sheet for that slot on the selected day. */
export function PlanAddButton({ slot, label, wide = false }: { slot: SlotKey; label: string; wide?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const open = () => openAddSheet(router, pathname, new URLSearchParams(window.location.search), slot);
  if (wide) {
    return (
      <button type="button" onClick={open} className="flex min-h-16 min-w-0 flex-1 items-center gap-1.5 text-left text-[15px] text-ink-2">
        <Plus className="size-4 shrink-0" /> <span className="truncate">{label}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={open} aria-label={label} className="grid size-11 shrink-0 place-items-center rounded-full">
      <Plus className="size-5" />
    </button>
  );
}

/** ⋯ on Plan: copy the selected day, or repeat a week. */
export function PlanMenu({ date, today, weekStart }: { date: string; today: string; weekStart: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Copy a day or repeat a week" className="grid size-11 place-items-center rounded-[14px] bg-surface-2">
        <MoreHorizontal className="size-5" />
      </button>
      {open && <CopySheet date={date} today={today} weekStart={weekStart} onClose={() => setOpen(false)} />}
    </>
  );
}

function CopySheet({ date, today, weekStart, onClose }: { date: string; today: string; weekStart: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"day" | "week">("day");
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Set<SlotKey>>(new Set(SLOTS));
  const [replace, setReplace] = useState(false);
  const [weekChoice, setWeekChoice] = useState<"next" | "this">("next");
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const days = Array.from({ length: 21 }, (_, i) => addDaysKey(weekStart, i));

  function done(res: { ok: true; count: number; ids: string[] } | { ok: false; error: string }, message: string) {
    // The sheet covers the toast, so errors show inside it.
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
    router.refresh();
    if (replace) toast.show({ message });
    else
      toast.undoable({
        message,
        commit: () => {},
        undo: () => void removeEntriesAction(res.ids).then(() => router.refresh()),
      });
  }

  function copyDay() {
    start(async () => {
      const res = await copyDayToDatesAction({ fromDate: date, toDates: [...targets], slots: [...slots], replace });
      done(res, res.ok ? `Copied ${res.count} item${res.count === 1 ? "" : "s"} to ${targets.size} day${targets.size === 1 ? "" : "s"}` : "");
    });
  }

  function repeatWeek() {
    const thisWeek = weekStart;
    const [fromStart, toStart] = weekChoice === "next" ? [thisWeek, addDaysKey(thisWeek, 7)] : [addDaysKey(thisWeek, -7), thisWeek];
    start(async () => {
      const res = await copyWeekAction({ fromStart, toStart, replace });
      done(res, res.ok ? `Copied ${res.count} item${res.count === 1 ? "" : "s"} into the week of ${format(parseISO(toStart), "d MMM")}` : "");
    });
  }

  return (
    <Sheet label="Copy" onClose={onClose}>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="seg" role="tablist" aria-label="Copy">
          <button type="button" role="tab" aria-selected={mode === "day"} className={cn(mode === "day" && "on")} onClick={() => setMode("day")}>
            Copy a day
          </button>
          <button type="button" role="tab" aria-selected={mode === "week"} className={cn(mode === "week" && "on")} onClick={() => setMode("week")}>
            Repeat a week
          </button>
        </div>

        {mode === "day" ? (
          <>
            <h2 className="t-h3">Copy {format(parseISO(date), "EEE d")} to…</h2>
            <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label="Days to copy to">
              {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
                <span key={i} className="text-xs text-ink-3">
                  {l}
                </span>
              ))}
              {days.map((d) => {
                const src = d === date;
                const on = targets.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={src}
                    aria-pressed={on}
                    aria-label={format(parseISO(d), "EEEE d MMMM")}
                    onClick={() =>
                      setTargets((t) => {
                        const n = new Set(t);
                        if (n.has(d)) n.delete(d);
                        else n.add(d);
                        return n;
                      })
                    }
                    className={cn(
                      "num grid h-11 place-items-center rounded-[12px] text-[15px]",
                      src && "border-2 border-ink font-semibold",
                      on && "bg-ink font-semibold text-inv",
                      !src && !on && d < today && "text-ink-3",
                    )}
                  >
                    {format(parseISO(d), "d")}
                  </button>
                );
              })}
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Slots</p>
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((s) => {
                  const on = slots.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      className={cn("chip sm", on && "on")}
                      onClick={() =>
                        setSlots((cur) => {
                          const n = new Set(cur);
                          if (n.has(s)) n.delete(s);
                          else n.add(s);
                          return n;
                        })
                      }
                    >
                      {SLOT_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Which week">
            {(
              [
                ["next", "This week → next week"],
                ["this", "Last week → this week"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={weekChoice === k}
                onClick={() => setWeekChoice(k)}
                className={cn("flex min-h-14 items-center rounded-card border px-4 text-left font-semibold", weekChoice === k ? "border-2 border-ink" : "border-line")}
              >
                {l}
              </button>
            ))}
            <p className="text-[13px] text-ink-3">Each day lands on the same weekday, in the same slots.</p>
          </div>
        )}

        <div className="seg" role="radiogroup" aria-label="Existing plans">
          <button type="button" role="radio" aria-checked={!replace} className={cn(!replace && "on")} onClick={() => setReplace(false)}>
            Add to what&apos;s there
          </button>
          <button type="button" role="radio" aria-checked={replace} className={cn(replace && "on")} onClick={() => setReplace(true)}>
            Replace
          </button>
        </div>
        {replace && <p className="-mt-2 text-[13px] text-ink-3">Replace clears what&apos;s planned there first. Eaten entries stay.</p>}

        {error && (
          <p role="alert" className="-mt-2 text-sm text-bad">
            {error}
          </p>
        )}
        {mode === "day" ? (
          <Button type="button" size="lg" disabled={busy || targets.size === 0 || slots.size === 0} onClick={copyDay}>
            {busy && <Loader2 className="animate-spin" />}
            {targets.size === 0 ? "Pick days to copy to" : `Copy to ${targets.size} day${targets.size === 1 ? "" : "s"} · as planned`}
          </Button>
        ) : (
          <Button type="button" size="lg" disabled={busy} onClick={repeatWeek}>
            {busy && <Loader2 className="animate-spin" />} Repeat week · as planned
          </Button>
        )}
      </div>
    </Sheet>
  );
}
