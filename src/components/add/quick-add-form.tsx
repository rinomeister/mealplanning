"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { fmtKcal } from "@/lib/macro-format";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { FlowScreen } from "@/components/add/flow-screen";
import { quickAddAction, removeEntriesAction } from "@/app/(app)/today/actions";

const MACRO_FIELDS = [
  { key: "carbs", label: "Carbs", letter: "C", cls: "m-c" },
  { key: "fat", label: "Fat", letter: "F", cls: "m-f" },
  { key: "sugar", label: "Sug.", letter: "S", cls: "m-s" },
  { key: "fiber", label: "Fib.", letter: "Fi", cls: "m-fi" },
] as const;

const ORDER = ["label", "kcal", "protein", "carbs", "fat", "sugar", "fiber"] as const;
type Field = (typeof ORDER)[number];

/**
 * Log bare numbers into a slot — restaurant food, someone else's cooking, a
 * best guess. Only calories are needed (or macros, from which kcal is
 * estimated). Nothing is saved to the Library.
 */
export function QuickAddForm({
  date,
  initialSlot,
  eatenFlag,
  backHref,
}: {
  date: string;
  initialSlot: SlotKey;
  eatenFlag: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [slot, setSlot] = useState<SlotKey>(initialSlot);
  const [vals, setVals] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const focusField = (f: Field) =>
    document.querySelector<HTMLInputElement>(`#quick-add-form [name="${f}"]`)?.focus();
  const [focused, setFocused] = useState<Field>("label");

  const num = (k: Field) => {
    const v = vals[k];
    if (!v || v.trim() === "") return null;
    const n = parseDecimal(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const kcal = num("kcal");
  const estimate = Math.round((num("protein") ?? 0) * 4 + (num("carbs") ?? 0) * 4 + (num("fat") ?? 0) * 9);
  const total = kcal ?? (estimate > 0 ? estimate : null);

  function move(dir: 1 | -1) {
    const i = ORDER.indexOf(focused);
    const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, i + dir))];
    focusField(next);
  }

  async function save() {
    if (total == null) {
      setError("Enter the calories (or the macros).");
      focusField("kcal");
      return;
    }
    setBusy(true);
    setError("");
    const res = await quickAddAction(
      {
        date,
        slot,
        label: vals.label ?? "",
        kcal,
        protein: num("protein"),
        fat: num("fat"),
        carbs: num("carbs"),
        sugar: num("sugar"),
        fiber: num("fiber"),
      },
      { eaten: eatenFlag },
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.undoable({
      message: `Added to ${SLOT_LABELS[slot]} · ${fmtKcal(total)} kcal`,
      commit: () => {},
      undo: () => void removeEntriesAction([res.id]),
    });
    router.push(backHref);
  }

  const input = (k: Field, extra?: string) => ({
    name: k,
    value: vals[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setVals((v) => ({ ...v, [k]: e.target.value })),
    onFocus: () => setFocused(k),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (k === "fiber") void save();
      else move(1);
    },
    enterKeyHint: (k === "fiber" ? "done" : "next") as "done" | "next",
    className: cn(
      "h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface pl-3.5 text-[17px] font-medium outline-none focus:border-2 focus:border-ink",
      extra,
    ),
  });

  return (
    <FlowScreen
      top={
        <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3">
          <Link href={backHref} className="-ml-1 flex h-11 items-center px-1 font-semibold">
            Cancel
          </Link>
          <h1 className="font-semibold">Quick add</h1>
          <label className="relative ml-auto flex h-11 items-center gap-1 text-ink-2">
            {SLOT_LABELS[slot]} <ChevronDown className="size-4" />
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as SlotKey)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Slot"
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      bottom={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="lg" className="w-[52px] px-0" aria-label="Previous field" onPointerDown={(e) => e.preventDefault()} onClick={() => move(-1)}>
            <ChevronUp />
          </Button>
          <Button type="button" variant="secondary" size="lg" className="w-[52px] px-0" aria-label="Next field" onPointerDown={(e) => e.preventDefault()} onClick={() => move(1)}>
            <ChevronDown />
          </Button>
          <Button type="button" size="lg" className="flex-1" disabled={busy} onPointerDown={(e) => e.preventDefault()} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />}
            Add{total != null ? ` · ${fmtKcal(total)} kcal` : ""}
          </Button>
        </div>
      }
    >
      <form
        id="quick-add-form"
        className="flex flex-col gap-4 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Name (optional)</span>
          <input autoFocus autoComplete="off" placeholder="e.g. Birthday cake slice" {...input("label")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Calories</span>
            <span className="relative">
              <input inputMode="decimal" {...input("kcal", "pr-12")} aria-invalid={!!error && total == null} />
              <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">kcal</span>
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              <span className="mb m-p">P</span> Protein
            </span>
            <span className="relative">
              <input inputMode="decimal" {...input("protein", "pr-9")} />
              <span className="pointer-events-none absolute right-3.5 top-0 flex h-[52px] items-center text-sm text-ink-3">g</span>
            </span>
          </label>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MACRO_FIELDS.map((f) => (
            <label key={f.key} className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-ink-2">
                <span className={cn("mb", f.cls)}>{f.letter}</span>
                <span className="truncate">{f.label}</span>
              </span>
              <input inputMode="decimal" aria-label={`${f.label} grams`} {...input(f.key)} />
            </label>
          ))}
        </div>
        {kcal == null && estimate > 0 && (
          <p className="text-sm text-ink-2">≈ {fmtKcal(estimate)} kcal from the macros (4 / 4 / 9 per gram).</p>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        <p className="text-[13px] text-ink-3">Only calories are required. Leave a macro empty if you don&apos;t know it.</p>
      </form>
    </FlowScreen>
  );
}
