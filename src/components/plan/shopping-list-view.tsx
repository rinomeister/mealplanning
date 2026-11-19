"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Calendar, CalendarRange, Check, Eraser, Home, ListOrdered, MoreHorizontal, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey } from "@/lib/dates";
import { useLongPress } from "@/lib/use-long-press";
import type { ListItem, ShoppingList } from "@/lib/shopping-list";
import { Sheet, SheetItem } from "@/components/ui/sheet";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";
import {
  clearCheckedAction,
  removeExtraAction,
  setAtHomeAction,
  setExtraAisleAction,
  setItemAisleAction,
  toggleExtraAction,
  toggleShoppingCheckAction,
} from "@/app/(app)/plan/list/actions";

function rangeText(start: string, end: string): string {
  const a = parseISO(start);
  const b = parseISO(end);
  return start === end ? format(a, "EEE d MMM") : `${format(a, "EEE d")} – ${format(b, "EEE d MMM")}`;
}

/**
 * Plan · List: everything to buy for the range, by aisle in store order.
 * Tick as you shop; long-press (or ⋯) an item to move it to another aisle,
 * mark it as already at home, or remove one you added yourself.
 */
export function ShoppingListView({
  list,
  range,
  today,
  custom,
  tabs,
}: {
  list: ShoppingList;
  range: { start: string; end: string };
  today: string;
  custom: boolean;
  tabs: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [checked, setChecked] = useState(() => new Set(list.groups.flatMap((g) => g.items.filter((i) => i.checked).map((i) => i.key))));
  const [menu, setMenu] = useState<null | "range" | "more">(null);
  const [itemMenu, setItemMenu] = useState<ListItem | null>(null);
  const [, start] = useTransition();

  const total = list.total;
  const left = total - checked.size;

  function toggle(item: ListItem) {
    const on = !checked.has(item.key);
    setChecked((s) => {
      const n = new Set(s);
      if (on) n.add(item.key);
      else n.delete(item.key);
      return n;
    });
    start(async () => {
      if (item.kind === "extra") await toggleExtraAction(item.key, on);
      else await toggleShoppingCheckAction(item.key, on);
    });
  }

  const setRange = (s: string, e: string) => {
    setMenu(null);
    router.replace(`/plan/list?start=${s}&end=${e}`, { scroll: false });
  };

  return (
    <>
      <header className="mb-4 flex items-center gap-2">
        <h1 className="t-title flex-1">Plan</h1>
        <Link href="/plan/list/add" aria-label="Add an item" className="grid size-11 place-items-center rounded-[14px] bg-surface-2">
          <Plus className="size-5" />
        </Link>
        <button type="button" onClick={() => setMenu("more")} aria-label="List options" className="grid size-11 place-items-center rounded-[14px]">
          <MoreHorizontal className="size-5" />
        </button>
      </header>

      {tabs}

      <div className="mb-2 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setMenu("range")} className="chip sm">
          <Calendar className="size-4" /> {rangeText(range.start, range.end)}
        </button>
        {total > 0 && (
          <span className="text-sm text-ink-2">
            <b className="num text-ink">{left}</b> of {total} left
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden>
          <div className="h-full rounded-full bg-good transition-[width] duration-300" style={{ width: `${((total - left) / total) * 100}%` }} />
        </div>
      )}

      {list.groups.length === 0 ? (
        <EmptyState
          title="Nothing to buy"
          description="Plan some meals or products for these days, or add an item yourself with +."
        />
      ) : (
        <div className="flex flex-col gap-4 pb-6">
          {list.groups.map((g) => (
            <section key={g.aisle.key} aria-label={g.aisle.label}>
              <h2 className="t-cap mb-1.5">{g.aisle.label}</h2>
              <ul className="card divide-y divide-line px-4">
                {g.items.map((item) => (
                  <Row key={item.key} item={item} checked={checked.has(item.key)} onToggle={() => toggle(item)} onMenu={() => setItemMenu(item)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {list.atHome.length > 0 && (
        <details className="group mb-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
            <Home className="size-4" /> Already at home ({list.atHome.length})
          </summary>
          <ul className="card mt-2 divide-y divide-line px-4">
            {list.atHome.map((item) => (
              <li key={item.key} className="flex min-h-14 items-center gap-3">
                <span className="min-w-0 flex-1 text-ink-2">{item.name}</span>
                <span className="num text-sm text-ink-3">{item.amount}</span>
                <button
                  type="button"
                  className="chip sm"
                  onClick={() => start(async () => void (await setAtHomeAction(item.key, false)))}
                >
                  <ShoppingCart className="size-4" /> Need it
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {menu === "range" && (
        <Sheet label="Shopping for" onClose={() => setMenu(null)}>
          <div className="flex flex-col gap-1 px-2 pb-4">
            <h2 className="t-h2 px-2 pb-2">Shopping for</h2>
            {custom && <SheetItem icon={<CalendarRange />} label="Planned days from today" hint="Default" onClick={() => router.replace("/plan/list", { scroll: false })} />}
            <SheetItem icon={<Calendar />} label="Today" onClick={() => setRange(today, today)} />
            <SheetItem icon={<Calendar />} label="Next 3 days" onClick={() => setRange(today, addDaysKey(today, 2))} />
            <SheetItem icon={<Calendar />} label="Next 7 days" onClick={() => setRange(today, addDaysKey(today, 6))} />
            <SheetItem icon={<Calendar />} label="Next 14 days" onClick={() => setRange(today, addDaysKey(today, 13))} />
            <form
              className="mt-2 grid grid-cols-2 gap-2 px-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const s = String(fd.get("s"));
                const en = String(fd.get("e"));
                if (s && en && en >= s) setRange(s, en);
              }}
            >
              <label className="flex min-w-0 flex-col gap-1 text-[13px] font-semibold text-ink-2">
                From
                <input type="date" name="s" defaultValue={range.start} className="h-11 w-full min-w-0 rounded-[12px] border border-line bg-surface px-2 text-base" />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-[13px] font-semibold text-ink-2">
                To
                <input type="date" name="e" defaultValue={range.end} className="h-11 w-full min-w-0 rounded-[12px] border border-line bg-surface px-2 text-base" />
              </label>
              <button type="submit" className="col-span-2 h-12 rounded-[14px] bg-ink px-4 font-semibold text-inv">
                Show these days
              </button>
            </form>
          </div>
        </Sheet>
      )}

      {menu === "more" && (
        <Sheet label="List options" onClose={() => setMenu(null)} history={false}>
          <div className="flex flex-col gap-1 px-2 pb-4">
            <SheetItem icon={<Plus />} label="Add an item" onClick={() => router.push("/plan/list/add")} />
            <SheetItem icon={<ListOrdered />} label="Edit aisles" hint="Order = your store's route" onClick={() => router.push("/plan/list/aisles")} />
            <SheetItem
              icon={<Eraser />}
              label={`Clear ${total - left} checked`}
              onClick={() => {
                setMenu(null);
                start(async () => {
                  await clearCheckedAction();
                  setChecked(new Set());
                  toast.show({ message: "Cleared the checked items" });
                });
              }}
            />
          </div>
        </Sheet>
      )}

      {itemMenu && (
        <ItemSheet
          item={itemMenu}
          aisles={list.aisles}
          onClose={() => setItemMenu(null)}
          onDone={(message) => {
            setItemMenu(null);
            if (message) toast.show({ message });
          }}
        />
      )}
    </>
  );
}

function Row({ item, checked, onToggle, onMenu }: { item: ListItem; checked: boolean; onToggle: () => void; onMenu: () => void }) {
  const press = useLongPress(onMenu);
  const tap = () => {
    if (!press.wasLongPress()) onToggle();
  };
  return (
    <li className="flex min-h-16 items-center gap-3" {...press.handlers}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`${item.name}${item.amount ? `, ${item.amount}` : ""}`}
        onClick={onToggle}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-[8px] border-2 transition-colors",
          checked ? "border-good bg-good text-white" : "border-ink-3",
        )}
      >
        {checked && <Check className="size-4" strokeWidth={3} />}
      </button>
      <button type="button" onClick={tap} className="min-w-0 flex-1 py-2.5 text-left" tabIndex={-1}>
        <span className={cn("block truncate font-semibold", checked && "text-ink-3 line-through")}>{item.name}</span>
        {item.from && <span className="block truncate text-[13px] text-ink-3">{item.from}</span>}
      </button>
      {item.amount && <span className={cn("num shrink-0 font-semibold", checked && "text-ink-3")}>{item.amount}</span>}
      <button type="button" onClick={onMenu} aria-label={`Options for ${item.name}`} className="-mr-2 grid size-11 shrink-0 place-items-center text-ink-3">
        <MoreHorizontal className="size-4" />
      </button>
    </li>
  );
}

function ItemSheet({
  item,
  aisles,
  onClose,
  onDone,
}: {
  item: ListItem;
  aisles: ShoppingList["aisles"];
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<void>, message?: string) =>
    start(async () => {
      await fn();
      onDone(message);
    });
  return (
    <Sheet label={item.name} onClose={onClose}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div>
          <h2 className="t-h2">{item.name}</h2>
          <p className="text-sm text-ink-3">{[item.amount, item.from].filter(Boolean).join(" · ")}</p>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Aisle</p>
          <div className="flex flex-wrap gap-2">
            {aisles.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={busy}
                aria-pressed={item.aisle === a.key}
                className={cn("chip sm", item.aisle === a.key && "on")}
                onClick={() =>
                  run(
                    () => (item.kind === "extra" ? setExtraAisleAction(item.key, a.key) : setItemAisleAction(item.name, a.key)),
                    `Moved to ${a.label}`,
                  )
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        {item.kind === "plan" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => setAtHomeAction(item.key, true), `${item.name}: at home`)}
            className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-surface-2 font-semibold"
          >
            <Home className="size-4" /> Already have it at home
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => removeExtraAction(item.key), `Removed ${item.name}`)}
            className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-surface-2 font-semibold text-bad"
          >
            <Trash2 className="size-4" /> Remove from list
          </button>
        )}
      </div>
    </Sheet>
  );
}
