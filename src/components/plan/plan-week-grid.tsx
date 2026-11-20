"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtG, fmtKcal } from "@/lib/macro-format";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { useToast } from "@/components/toast";
import { openAddSheet } from "@/components/add/add-sheet";
import { moveCellAction } from "@/app/(app)/plan/actions";
import { removeEntriesAction } from "@/app/(app)/today/actions";

export type GridDay = { date: string; kcal: number; protein: number; has: boolean };
export type GridCell = { names: string[]; kcal: number; protein: number; eaten: boolean };

const DRAG_TYPE = "application/x-plan-cell";

/**
 * Desktop Plan · Week: the whole week as a grid, days across and slots down.
 * Click an empty cell for the Add panel on that day and slot; click a card to
 * open the day. Drag a card onto another cell to move it; hold Alt to copy.
 */
export function PlanWeekGrid({
  days,
  cells,
  today,
  selected,
  kcalTarget,
}: {
  days: GridDay[];
  cells: Record<string, GridCell>;
  today: string;
  selected: string;
  kcalTarget: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  function add(date: string, slot: SlotKey) {
    const q = new URLSearchParams(window.location.search);
    q.set("date", date);
    openAddSheet(router, pathname, q, slot);
  }

  function drop(from: { date: string; slot: SlotKey }, to: { date: string; slot: SlotKey }, copy: boolean) {
    if (from.date === to.date && from.slot === to.slot) return;
    start(async () => {
      const res = await moveCellAction({ fromDate: from.date, fromSlot: from.slot, toDate: to.date, toSlot: to.slot, copy });
      if (!res.ok) {
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      // The action refreshes the page itself (next/cache refresh()).
      const where = `${SLOT_LABELS[to.slot]}, ${format(parseISO(to.date), "EEE d")}`;
      toast.undoable({
        message: copy ? `Copied to ${where}` : `Moved to ${where}`,
        commit: () => {},
        undo: () =>
          void (copy
            ? removeEntriesAction(res.ids)
            : moveCellAction({ fromDate: to.date, fromSlot: to.slot, toDate: from.date, toSlot: from.slot, copy: false })
          ),
      });
    });
  }

  return (
    <div className="hidden desk:block">
      <div className="grid grid-cols-[84px_repeat(7,minmax(0,1fr))] gap-2">
        <span />
        {days.map((d) => {
          const frac = kcalTarget ? Math.min(1, d.kcal / kcalTarget) : d.has ? 1 : 0;
          return (
            <Link
              key={d.date}
              href={`/plan?date=${d.date}`}
              replace
              scroll={false}
              aria-current={d.date === selected ? "date" : undefined}
              className={cn(
                "flex min-w-0 flex-col gap-1.5 rounded-[12px] border-2 px-2 py-1.5",
                d.date === selected ? "border-ink" : "border-transparent hover:bg-surface-2",
              )}
            >
              <span className={cn("truncate text-sm font-semibold", d.date === today && "underline underline-offset-4")}>
                {format(parseISO(d.date), "EEE d")}
              </span>
              <span className="block h-1 overflow-hidden rounded-full bg-track">
                <span className="block h-full rounded-full bg-kcal" style={{ width: `${frac * 100}%` }} />
              </span>
              <span className="num truncate text-xs text-ink-3">
                {d.has ? `${fmtKcal(d.kcal)} kcal · Protein ${fmtG(d.protein)} g` : "empty"}
              </span>
            </Link>
          );
        })}

        {SLOTS.map((slot) => (
          <Row key={slot}>
            <span className="pt-3 text-sm text-ink-2">{SLOT_LABELS[slot]}</span>
            {days.map((d) => {
              const key = `${d.date}|${slot}`;
              const cell = cells[key];
              const target = over === key && dragging !== key;
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
                    setOver(key);
                  }}
                  onDragLeave={() => setOver((o) => (o === key ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    const raw = e.dataTransfer.getData(DRAG_TYPE);
                    if (raw) drop(JSON.parse(raw), { date: d.date, slot }, e.altKey);
                  }}
                  className={cn("min-h-24 rounded-[14px]", target && "outline-2 outline-offset-2 outline-dashed outline-pro")}
                >
                  {cell ? (
                    <Link
                      href={`/today?date=${d.date}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ date: d.date, slot }));
                        e.dataTransfer.effectAllowed = "copyMove";
                        setDragging(key);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      title="Drag to move · Alt-drag to copy"
                      className={cn(
                        "card flex h-full min-h-24 flex-col gap-0.5 p-2.5 hover:border-ink-3",
                        dragging === key && "opacity-50",
                      )}
                    >
                      <span className="line-clamp-2 text-sm font-semibold leading-snug">{cell.names.join(" + ")}</span>
                      <span className="num text-xs text-ink-3">
                        {fmtKcal(cell.kcal)} kcal · Protein {fmtG(cell.protein)} g{cell.eaten && " · eaten"}
                      </span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => add(d.date, slot)}
                      aria-label={`Add to ${SLOT_LABELS[slot]} on ${format(parseISO(d.date), "EEEE d MMMM")}`}
                      className="grid h-full min-h-24 w-full place-items-center rounded-[14px] border border-dashed border-line text-ink-3 hover:border-ink-3 hover:bg-surface-2/50"
                    >
                      <Plus className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </Row>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink-3">
        Drag a card to another cell to move it; hold Alt while dragging to copy. Click an empty cell to add to it.
      </p>
    </div>
  );
}

/** Fragment stand-in so each slot's cells sit in the parent grid. */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
