"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Ban,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { Sheet, SheetItem } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { addDaysKey, formatHuman } from "@/lib/dates";
import { fmtG, fmtKcal } from "@/lib/macro-format";
import type { DayEntry } from "@/lib/day-entry";
import type { Macros } from "@/lib/macros";

/** A day to copy to: tomorrow, a week on, or any picked date. */
function DayPicker({
  from,
  verb,
  onPick,
  onBack,
}: {
  from: string;
  verb: string;
  onPick: (date: string) => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState(addDaysKey(from, 1));
  return (
    <>
      <div className="flex items-center gap-1 px-3 pb-1">
        <button type="button" onClick={onBack} className="grid size-11 place-items-center rounded-[14px]" aria-label="Back">
          <ChevronLeft className="size-5" />
        </button>
        <p className="t-h2">{verb}</p>
      </div>
      <SheetItem icon={<ArrowRight />} label="Tomorrow" value={formatHuman(addDaysKey(from, 1))} onClick={() => onPick(addDaysKey(from, 1))} />
      <SheetItem icon={<ArrowRight />} label="Same day next week" value={formatHuman(addDaysKey(from, 7))} onClick={() => onPick(addDaysKey(from, 7))} />
      <div className="flex items-end gap-2 px-5 pb-5 pt-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Another day</span>
          <input
            type="date"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] font-medium"
          />
        </label>
        <Button type="button" size="lg" disabled={!picked} onClick={() => onPick(picked)}>
          Copy
        </Button>
      </div>
    </>
  );
}

/** Long-press menu for one entry — the same actions a swipe would offer. */
export function EntryMenu({
  date,
  entry,
  onClose,
  onStatus,
  onChangeAmount,
  onMove,
  onCopy,
  onRemove,
}: {
  date: string;
  entry: DayEntry;
  onClose: () => void;
  onStatus: (status: DayEntry["status"]) => void;
  onChangeAmount: () => void;
  onMove: (slot: SlotKey) => void;
  onCopy: (date: string) => void;
  onRemove: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<"menu" | "move" | "copy">("menu");
  const eaten = entry.status === "EATEN";
  const skipped = entry.status === "SKIPPED";

  return (
    <Sheet label={`${entry.name} options`} onClose={onClose}>
      {view === "menu" && (
        <div className="pb-3">
          <p className="truncate px-5 pb-2 pt-1 text-base font-semibold">{entry.name}</p>
          {!skipped && (
            <SheetItem
              icon={eaten ? <RotateCcw /> : <Check />}
              label={eaten ? "Mark as not eaten" : "Mark eaten"}
              onClick={() => {
                onStatus(eaten ? "PLANNED" : "EATEN");
                onClose();
              }}
            />
          )}
          {entry.kind !== "quick" && (
            <SheetItem
              icon={<Pencil />}
              label="Change amount"
              onClick={() => {
                onClose();
                onChangeAmount();
              }}
            />
          )}
          <SheetItem icon={<ArrowRight />} label="Move to another slot" value={SLOT_LABELS[entry.slot]} onClick={() => setView("move")} />
          <SheetItem icon={<Copy />} label="Copy to another day" onClick={() => setView("copy")} />
          <SheetItem
            icon={skipped ? <Undo2 /> : <Ban />}
            label={skipped ? "Restore (not skipped)" : "Skip"}
            hint={skipped ? undefined : "Keeps it on the day without counting it"}
            onClick={() => {
              onStatus(skipped ? "PLANNED" : "SKIPPED");
              onClose();
            }}
          />
          {entry.href && (
            <SheetItem
              icon={<ChevronRight />}
              label="Open meal"
              onClick={() => {
                onClose();
                router.push(entry.href!);
              }}
            />
          )}
          <div className="mx-5 my-1 h-px bg-line" />
          <SheetItem
            icon={<Trash2 />}
            label="Remove"
            danger
            onClick={() => {
              onRemove();
              onClose();
            }}
          />
        </div>
      )}
      {view === "move" && (
        <div className="pb-3">
          <div className="flex items-center gap-1 px-3 pb-1">
            <button type="button" onClick={() => setView("menu")} className="grid size-11 place-items-center rounded-[14px]" aria-label="Back">
              <ChevronLeft className="size-5" />
            </button>
            <p className="t-h2">Move to</p>
          </div>
          {SLOTS.filter((s) => s !== entry.slot).map((s) => (
            <SheetItem
              key={s}
              icon={<ArrowRight />}
              label={SLOT_LABELS[s]}
              onClick={() => {
                onMove(s);
                onClose();
              }}
            />
          ))}
        </div>
      )}
      {view === "copy" && (
        <DayPicker
          from={date}
          verb={`Copy ${entry.name}`}
          onBack={() => setView("menu")}
          onPick={(d) => {
            onCopy(d);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

/** The ⋯ menu on a slot header. */
export function SlotMenu({
  date,
  slot,
  totals,
  hasEntries,
  hasPlanned,
  yesterday,
  onClose,
  onSameAsYesterday,
  onCopyTo,
  onSaveAsMeal,
  onMarkAllEaten,
  onClear,
}: {
  date: string;
  slot: SlotKey;
  totals: Macros;
  hasEntries: boolean;
  hasPlanned: boolean;
  yesterday?: { names: string[]; kcal: number };
  onClose: () => void;
  onSameAsYesterday: () => void;
  onCopyTo: (date: string) => void;
  onSaveAsMeal: () => void;
  onMarkAllEaten: () => void;
  onClear: () => void;
}) {
  const [view, setView] = useState<"menu" | "copy">("menu");
  const label = SLOT_LABELS[slot];
  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <Sheet label={`${label} options`} onClose={onClose}>
      {view === "menu" ? (
        <div className="pb-3">
          <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-1">
            <p className="t-h2">{label}</p>
            {hasEntries && (
              <p className="text-sm text-ink-3">
                <span className="num font-semibold text-ink">{fmtKcal(totals.kcal)}</span> kcal · Protein {fmtG(totals.protein)} g
              </p>
            )}
          </div>
          <SheetItem
            icon={<RotateCcw />}
            label="Same as yesterday"
            hint={
              yesterday
                ? `Adds ${yesterday.names.join(", ")} · ${fmtKcal(yesterday.kcal)} kcal`
                : `Nothing in yesterday's ${label.toLowerCase()}`
            }
            disabled={!yesterday}
            onClick={run(onSameAsYesterday)}
          />
          <SheetItem icon={<Copy />} label="Copy slot to…" disabled={!hasEntries} onClick={() => setView("copy")} />
          <SheetItem icon={<BookmarkPlus />} label="Save as meal" disabled={!hasEntries} onClick={run(onSaveAsMeal)} />
          <SheetItem icon={<Check />} label="Mark all eaten" disabled={!hasPlanned} onClick={run(onMarkAllEaten)} />
          <div className="mx-5 my-1 h-px bg-line" />
          <SheetItem icon={<Trash2 />} label="Clear slot" danger disabled={!hasEntries} onClick={run(onClear)} />
        </div>
      ) : (
        <DayPicker
          from={date}
          verb={`Copy ${label} to`}
          onBack={() => setView("menu")}
          onPick={(d) => {
            onCopyTo(d);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
