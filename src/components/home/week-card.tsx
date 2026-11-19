import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtG, fmtKcal, type Targets } from "@/lib/macro-format";

export type WeekDay = {
  date: string;
  letter: string;
  kcal: number;
  protein: number;
  sugar: number;
  when: "past" | "today" | "future";
};

const R = 11;
const C = 2 * Math.PI * R;

/** One day: a small kcal ring over a protein bar. */
function DayRing({ day, targets }: { day: WeekDay; targets: Targets }) {
  const kt = targets.kcal;
  const pt = targets.protein;
  const kFrac = kt ? Math.min(1, day.kcal / kt) : 0;
  const over = kt != null && day.kcal > kt * 1.05;
  const pFrac = pt ? Math.min(1, day.protein / pt) : 0;
  const empty = day.when === "future" || (day.kcal === 0 && day.when === "past");
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="30" height="30" viewBox="0 0 30 30" className="-rotate-90">
        <circle cx="15" cy="15" r={R} fill="none" stroke="var(--track)" strokeWidth="4" strokeDasharray={empty ? "2 3" : undefined} />
        {!empty && kFrac > 0 && (
          <circle
            cx="15"
            cy="15"
            r={R}
            fill="none"
            stroke={over ? "var(--bad)" : "var(--kcal)"}
            strokeWidth="4"
            strokeDasharray={`${C * kFrac} ${C}`}
          />
        )}
        {day.when === "today" && (
          <circle cx="15" cy="15" r={R} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="2 2" opacity=".5" />
        )}
      </svg>
      <span className="block h-1 w-[22px] overflow-hidden rounded-full bg-track">
        <span className="block h-full bg-pro" style={{ width: `${empty ? 0 : pFrac * 100}%` }} />
      </span>
      <span className={cn("text-xs", day.when === "today" ? "font-bold" : "text-ink-3")}>{day.letter}</span>
    </div>
  );
}

/** This week, Monday to Sunday: kcal ring and protein bar per day. */
export function WeekCard({ days, targets }: { days: WeekDay[]; targets: Targets }) {
  // Finished days that have anything logged.
  const done = days.filter((d) => d.when === "past" && d.kcal > 0);
  const pt = targets.protein;
  const hit = pt ? done.filter((d) => d.protein >= pt).length : null;
  const sugarOver = targets.sugar ? done.filter((d) => d.sugar > targets.sugar!).length : 0;
  const avg = (k: "kcal" | "protein") => done.reduce((s, d) => s + d[k], 0) / (done.length || 1);

  return (
    <Link href="/plan" className="card press flex flex-col gap-2.5 px-4 py-3.5" aria-label="This week. Open the plan">
      <div className="flex items-baseline gap-1.5">
        <span className="t-h3 flex-1">This week</span>
        {hit != null && done.length > 0 && (
          <>
            <span className="text-xs text-ink-3">protein hit</span>
            <span className="num font-semibold">
              {hit} / {done.length}
            </span>
            <span className="text-xs text-ink-3">days</span>
          </>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center" aria-hidden>
        {days.map((d) => (
          <DayRing key={d.date} day={d} targets={targets} />
        ))}
      </div>
      <p className="text-xs text-ink-2">
        {done.length === 0
          ? "Averages show once a full day is logged."
          : `Avg ${fmtKcal(avg("kcal"))} kcal · ${fmtG(avg("protein"))} g protein${
              sugarOver > 0 ? ` · sugar over on ${sugarOver} day${sugarOver === 1 ? "" : "s"}` : ""
            }`}
      </p>
    </Link>
  );
}
