import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { MACROS_UI, fmtG, fmtKcal, type Targets } from "@/lib/macro-format";
import type { Macros } from "@/lib/macros";
import type { ProgressDay, WeighIn } from "@/lib/progress";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { MacroDot, MacroBar, barState } from "@/components/macro-ui";

/**
 * Protein per day. Solid = target hit, faded = missed, hatched = today so far.
 * The target is a dashed line.
 */
export function ProteinChart({ days, target }: { days: ProgressDay[]; target: number | null }) {
  const max = Math.max(target ? target * 1.15 : 0, ...days.map((d) => d.eaten.protein), 1);
  const n = days.length;
  const hit = days.filter((d) => !d.today && target && d.eaten.protein >= target).length;
  const past = days.filter((d) => !d.today && d.logged).length;
  const summary = target
    ? `Protein target hit on ${hit} of ${past} logged days.`
    : `Protein per day over the last ${n} days.`;

  return (
    <div role="img" aria-label={summary}>
      <div className={cn("relative flex h-36 items-end", n <= 7 ? "gap-2.5" : n <= 30 ? "gap-[3px]" : "gap-px")}>
        {target != null && target > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3"
            style={{ bottom: `${(target / max) * 100}%` }}
            aria-hidden
          />
        )}
        {days.map((d) => {
          const h = (d.eaten.protein / max) * 100;
          const ok = target != null && d.eaten.protein >= target;
          return (
            <div key={d.date} className="flex h-full min-w-0 flex-1 items-end" title={`${format(parseISO(d.date), "EEE d MMM")}: ${fmtG(d.eaten.protein)} g`}>
              {d.logged ? (
                <div
                  className={cn("w-full", n <= 7 ? "rounded-t-[8px] rounded-b-[4px]" : "rounded-t-[3px]")}
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    background: d.today
                      ? "repeating-linear-gradient(135deg, var(--pro) 0 4px, transparent 4px 8px)"
                      : "var(--pro)",
                    opacity: d.today || ok || target == null ? 1 : 0.45,
                    boxShadow: d.today ? "inset 0 0 0 2px var(--pro)" : undefined,
                  }}
                />
              ) : (
                <div className="h-1 w-full rounded-full bg-track" />
              )}
            </div>
          );
        })}
      </div>
      {n <= 7 ? (
        <div className="mt-2 flex gap-2.5 text-xs text-ink-3" aria-hidden>
          {days.map((d) => (
            <span key={d.date} className="min-w-0 flex-1 text-center">
              {format(parseISO(d.date), "EEEEE")}
            </span>
          ))}
        </div>
      ) : (
        // A date every week or two, counted back from today; the edge labels
        // hug the edges so they never clip.
        <div className="relative mt-2 h-4 text-xs text-ink-3" aria-hidden>
          {days.map((d, i) => {
            if ((n - 1 - i) % (n <= 30 ? 7 : 14) !== 0) return null;
            const at = ((i + 0.5) / n) * 100;
            const shift = at > 88 ? "-100%" : at < 12 ? "0%" : "-50%";
            return (
              <span key={d.date} className="absolute whitespace-nowrap" style={{ left: `${at}%`, transform: `translateX(${shift})` }}>
                {d.today ? "Today" : format(parseISO(d.date), "d MMM")}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** N-day averages against target: calories, then P · C · F · S · Fi. */
export function AveragesList({ avg, targets }: { avg: Macros; targets: Targets }) {
  const kcalPct = targets.kcal ? Math.min(100, (avg.kcal / targets.kcal) * 100) : 0;
  return (
    <ul className="flex flex-col gap-3">
      <li className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3">
        <span className="font-semibold">Calories</span>
        <div className="bar m-k" aria-hidden>
          <i style={{ width: `${kcalPct}%` }} />
        </div>
        <Value v={fmtKcal(avg.kcal)} t={targets.kcal != null ? fmtKcal(targets.kcal) : null} />
      </li>
      {MACROS_UI.map((m) => {
        const v = avg[m.key];
        const t = targets[m.key];
        const over = barState(m.key, v, t) === "over";
        return (
          <li key={m.key} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3">
            <span className="flex items-center gap-2">
              <MacroDot macro={m.key} />
              {m.label}
            </span>
            <MacroBar macro={m.key} eaten={v} target={t} />
            <Value v={fmtG(v)} t={t != null ? fmtG(t) : null} bad={over} />
          </li>
        );
      })}
    </ul>
  );
}

function Value({ v, t, bad }: { v: string; t: string | null; bad?: boolean }) {
  return (
    <span className="num text-right text-[15px]">
      <b className={cn("font-semibold", bad && "text-bad")}>{v}</b>
      {t != null && <span className="text-ink-3">/{t}</span>}
    </span>
  );
}

/** Dots = weigh-ins, line = 7-day trend, over a fixed window ending today. */
export function WeightChart({
  weighIns,
  start,
  end,
  units,
}: {
  weighIns: WeighIn[];
  start: string;
  end: string;
  units: UnitSystem;
}) {
  const W = 320;
  const H = 110;
  const pad = 8;
  const t0 = parseISO(start).getTime();
  const span = Math.max(1, parseISO(end).getTime() - t0);
  const vals = weighIns.flatMap((w) => [kgToDisplay(w.kg, units), kgToDisplay(w.trend, units)]);
  const lo = Math.min(...vals) - 0.3;
  const hi = Math.max(...vals) + 0.3;
  const x = (d: string) => pad + ((parseISO(d).getTime() - t0) / span) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - pad * 2);
  const line = weighIns.map((w, i) => `${i ? "L" : "M"}${x(w.date).toFixed(1)},${y(kgToDisplay(w.trend, units)).toFixed(1)}`).join(" ");
  const last = weighIns.at(-1);
  const label = last
    ? `Bodyweight, ${weighIns.length} weigh-ins. Latest ${kgToDisplay(last.kg, units)} ${weightLabel(units)}, trend ${kgToDisplay(last.trend, units).toFixed(1)}.`
    : "No weigh-ins yet.";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto max-h-48 w-full" role="img" aria-label={label}>
      {weighIns.length > 1 && <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {weighIns.map((w) => (
        <circle key={w.id} cx={x(w.date)} cy={y(kgToDisplay(w.kg, units))} r={2.6} fill="var(--ink-3)" />
      ))}
    </svg>
  );
}
