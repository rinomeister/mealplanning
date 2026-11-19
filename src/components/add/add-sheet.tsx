"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CookingPot, Loader2, Plus, RotateCcw, ScanBarcode, Search, X, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { flowHref, parseDate, parseSlot } from "@/lib/add-flow";
import { fmtG, fmtKcal } from "@/lib/macro-format";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/toast";
import { addPlanEntryAction } from "@/app/(app)/plan/actions";
import {
  copySlotFromDateAction,
  getAddSheetDataAction,
  logExistingProductAction,
  removeEntriesAction,
  type RecentItem,
} from "@/app/(app)/today/actions";

/** Marks that "+" pushed ?add= onto history, so closing can go back instead. */
const PUSHED_KEY = "add-sheet-pushed";
function markPushed(on: boolean) {
  try {
    if (on) sessionStorage.setItem(PUSHED_KEY, "1");
    else sessionStorage.removeItem(PUSHED_KEY);
  } catch {
    // Storage blocked: closing falls back to replacing the URL.
  }
}
function wasPushed(): boolean {
  try {
    return sessionStorage.getItem(PUSHED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Open the Add sheet over the current page for a slot (the "+" button). */
export function openAddSheet(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  search: URLSearchParams,
  slot: SlotKey,
) {
  const q = new URLSearchParams(search);
  q.set("add", slot);
  markPushed(true);
  router.push(`${pathname}?${q}`, { scroll: false });
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The Add sheet: pick the slot, then scan / product / saved meal / quick add,
 * or one tap on "same as yesterday" or a recent item at its last amount. Lives
 * in the URL (?add=<slot>) so back closes it. Mounted once in the app shell.
 */
export function AddSheet() {
  const params = useSearchParams();
  const slotParam = parseSlot(params.get("add"));
  if (!slotParam) return null;
  return <AddSheetBody key={slotParam} initialSlot={slotParam} />;
}

function AddSheetBody({ initialSlot }: { initialSlot: SlotKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [slot, setSlot] = useState<SlotKey>(initialSlot);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAddSheetDataAction>> | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The day: the one Today is showing, else today on this phone.
  const today = localToday();
  const date = ((pathname === "/today" || pathname === "/plan") && parseDate(params.get("date"))) || today;
  const eaten = date <= today;

  useEffect(() => {
    let live = true;
    void getAddSheetDataAction(date, slot).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [date, slot]);

  function close() {
    if (wasPushed()) {
      markPushed(false);
      router.back();
      return;
    }
    const q = new URLSearchParams(params);
    q.delete("add");
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  function done(message: string, undoIds: string[]) {
    close();
    toast.undoable({
      message,
      commit: () => {},
      undo: () => startTransition(async () => void (await removeEntriesAction(undoIds))),
    });
  }

  function addRecent(r: RecentItem) {
    setPending(`${r.kind}${r.id}`);
    startTransition(async () => {
      const res =
        r.kind === "product"
          ? await logExistingProductAction({ date, slot, productId: r.id, grams: r.grams ?? 100 }, { eaten })
          : await addPlanEntryAction({ date, slot, mealId: r.id, servings: r.servings, grams: r.grams }, { eaten });
      setPending(null);
      if (res.ok) done(`Added to ${SLOT_LABELS[slot]} · ${fmtKcal(r.kcal)} kcal`, [res.id]);
      else toast.show({ message: res.error, tone: "error" });
    });
  }

  function sameAsYesterday() {
    setPending("yesterday");
    startTransition(async () => {
      const res = await copySlotFromDateAction({ fromDate: yesterdayOf(date), toDate: date, slot });
      setPending(null);
      if (res.ok) done(`Added ${res.count} from yesterday`, res.ids);
      else toast.show({ message: res.error, tone: "error" });
    });
  }

  const tile =
    "press flex h-[84px] flex-col justify-between rounded-card bg-surface-2 p-3.5 text-left text-[17px] font-semibold [&_svg]:size-5";

  return (
    <Sheet label={`Add to ${SLOT_LABELS[slot]}`} onClose={close} history={false}>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="t-h2">
            Add to{date !== today && <span className="text-ink-3"> · {format(parseISO(date), "EEE d")}</span>}
          </h2>
          <button type="button" onClick={close} className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Slot">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={slot === s}
              onClick={() => setSlot(s)}
              className={cn("chip sm", slot === s && "on")}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Link href={flowHref("scan", slot, date)} className={tile}>
            <ScanBarcode /> Scan barcode
          </Link>
          <Link href={flowHref("search", slot, date)} className={tile}>
            <Search /> Product
          </Link>
          <Link href={flowHref("meal", slot, date)} className={tile}>
            <CookingPot /> Saved meal
          </Link>
          <Link href={flowHref("quick", slot, date)} className={tile}>
            <Zap /> Quick add
          </Link>
        </div>

        {data?.yesterday && (
          <button
            type="button"
            onClick={sameAsYesterday}
            disabled={pending === "yesterday"}
            className="press flex min-h-[56px] items-center gap-3 rounded-card border border-line px-4 text-left"
          >
            {pending === "yesterday" ? <Loader2 className="size-5 animate-spin" /> : <RotateCcw className="size-5 shrink-0" />}
            <span className="shrink-0 font-semibold">Same as yesterday</span>
            <span className="min-w-0 flex-1 truncate text-right text-sm text-ink-3">
              {data.yesterday.names.join(", ")} · {fmtKcal(data.yesterday.kcal)}
            </span>
          </button>
        )}

        <section aria-label="Recent">
          <h3 className="t-cap mb-1">Recent · last amount</h3>
          {data == null ? (
            <div className="flex flex-col gap-3 py-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="block h-10 rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : data.recents.length === 0 ? (
            <p className="py-3 text-sm text-ink-3">Things you log show up here with their amounts.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recents.map((r) => {
                const key = `${r.kind}${r.id}`;
                return (
                  <li key={key} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.name}</span>
                      <span className="block truncate text-[13px] text-ink-3">
                        {r.amount} · {fmtKcal(r.kcal)} kcal · {fmtG(r.protein)} P
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => addRecent(r)}
                      disabled={pending === key}
                      className="press grid size-11 shrink-0 place-items-center rounded-full bg-surface-2"
                      aria-label={`Add ${r.amount} of ${r.name}`}
                    >
                      {pending === key ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
