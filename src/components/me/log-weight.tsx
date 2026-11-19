"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { addDaysKey } from "@/lib/dates";
import { displayToKg, kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { FlowScreen } from "@/components/add/flow-screen";
import { useToast } from "@/components/toast";
import { addBodyweightAction } from "@/app/(app)/me/actions";

/** Progress → Log weight. Full screen: one number, a day, Save. */
export function LogWeight({
  today,
  units,
  last,
  trendKg,
  from,
}: {
  today: string;
  units: UnitSystem;
  last: { date: string; kg: number } | null;
  trendKg: number | null;
  from: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unit = weightLabel(units);
  const n = parseDecimal(value);
  const valid = value.trim() !== "" && Number.isFinite(n) && n > 0;
  const yesterday = addDaysKey(today, -1);

  async function save() {
    if (!valid) {
      setError(`Type your weight in ${unit}.`);
      return;
    }
    setBusy(true);
    const res = await addBodyweightAction({ weightKg: displayToKg(n, units), recordedAt: date });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.show({ message: `Saved ${n} ${unit}${date === today ? "" : ` for ${format(parseISO(date), "EEE d MMM")}`}` });
    router.push(from);
  }

  const chip = (on: boolean) => cn("chip sm", on && "on");

  return (
    <FlowScreen
      top={
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3">
          <button type="button" onClick={() => router.back()} className="-ml-1 h-11 px-1 font-semibold">
            Cancel
          </button>
          <h1 className="text-center font-semibold">Log weight</h1>
          <span className="w-14" />
        </div>
      }
      bottom={
        <Button type="button" size="lg" className="w-full" disabled={busy} onPointerDown={(e) => e.preventDefault()} onClick={() => void save()}>
          {busy && <Loader2 className="animate-spin" />}
          {valid ? `Save ${n} ${unit}` : "Save"}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Day">
          <button type="button" role="radio" aria-checked={date === today && !picking} className={chip(date === today && !picking)} onPointerDown={(e) => e.preventDefault()} onClick={() => { setDate(today); setPicking(false); }}>
            Today
          </button>
          <button type="button" role="radio" aria-checked={date === yesterday && !picking} className={chip(date === yesterday && !picking)} onPointerDown={(e) => e.preventDefault()} onClick={() => { setDate(yesterday); setPicking(false); }}>
            Yesterday
          </button>
          <button type="button" role="radio" aria-checked={picking} className={chip(picking)} onClick={() => setPicking(true)}>
            {picking ? format(parseISO(date), "EEE d MMM") : "Pick date"}
          </button>
        </div>
        {picking && (
          <input
            type="date"
            aria-label="Date"
            max={today}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-12 w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3 text-base"
          />
        )}
        <label htmlFor="weight" className="mt-1 text-[13px] font-semibold text-ink-2">
          Weight
        </label>
        <div className="flex h-16 items-center rounded-[14px] border-2 border-ink bg-surface px-4">
          <input
            id="weight"
            autoFocus
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={value}
            placeholder={last ? kgToDisplay(last.kg, units).toFixed(1) : "0.0"}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            className="num min-w-0 flex-1 bg-transparent text-[30px] font-semibold outline-none placeholder:text-ink-3"
          />
          <span className="text-ink-3">{unit}</span>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        {last && (
          <p className="text-sm text-ink-3">
            Last: {kgToDisplay(last.kg, units).toFixed(1)} {unit}{" "}
            {last.date === today
              ? "today"
              : last.date === yesterday
                ? "yesterday"
                : `on ${format(parseISO(last.date), last.date >= addDaysKey(today, -6) ? "EEE" : "d MMM")}`}
            {trendKg != null && ` · trend ${kgToDisplay(trendKg, units).toFixed(1)} ${unit}`}
          </p>
        )}
        <p className="text-sm text-ink-3">One weigh-in per day: logging again on the same day replaces it.</p>
      </form>
    </FlowScreen>
  );
}
