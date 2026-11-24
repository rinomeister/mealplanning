import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MACROS_UI,
  MACRO_UI_BY_KEY,
  fmtG,
  fmtKcal,
  type GramMacro,
  type Targets,
} from "@/lib/macro-format";
import type { Macros } from "@/lib/macros";

/*
 * The macro language. Kcal is a ring whose centre shows what's left; every
 * gram macro is a bar with one colour and its full name, in the order Protein ·
 * Carbs · Fat · Sugar · Fiber (no single-letter labels). Numbers stay ink — colour is only for bars, badges and dots, so a
 * macro is never told apart by colour alone.
 */

/** Macro label: colour dot + full name ("● Protein"). Where a name is already
 * shown beside it, use MacroDot instead. */
export function MacroBadge({ macro, className }: { macro: GramMacro; className?: string }) {
  const m = MACRO_UI_BY_KEY[macro];
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 text-[12px] font-semibold text-ink-2", className)}>
      <MacroDot macro={macro} />
      <span className="truncate">{m.label}</span>
    </span>
  );
}

export function MacroDot({ macro }: { macro: GramMacro }) {
  return <span className={cn("mdot", MACRO_UI_BY_KEY[macro].cls)} aria-hidden />;
}

/** Row line: "612 kcal · ● 44 · ● 60 · ● 20" (kcal + P/C/F). */
export function MacroLine({ macros, className }: { macros: Macros; className?: string }) {
  const label = `${fmtKcal(macros.kcal)} kcal, protein ${fmtG(macros.protein)} g, carbs ${fmtG(macros.carbs)} g, fat ${fmtG(macros.fat)} g`;
  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm", className)}
      aria-label={label}
      role="img"
    >
      <span className="num font-semibold text-ink">{fmtKcal(macros.kcal)} kcal</span>
      {(["protein", "carbs", "fat"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1 font-semibold text-ink-2">
          <MacroDot macro={k} />
          <span className="num">{fmtG(macros[k])}</span>
        </span>
      ))}
    </span>
  );
}

/** All six numbers for one item, 3 × 2: Calories, then each gram macro with its name. */
export function MacroGrid({ macros, className }: { macros: Macros; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-3 gap-1.5", className)}>
      <div className="min-w-0 rounded-[12px] bg-surface-2 px-2.5 py-1.5">
        <dt className="truncate text-[12px] font-semibold text-ink-2">Calories</dt>
        <dd className="num text-[15px] font-semibold">{fmtKcal(macros.kcal)} kcal</dd>
      </div>
      {MACROS_UI.map((m) => (
        <div key={m.key} className="min-w-0 rounded-[12px] bg-surface-2 px-2.5 py-1.5">
          <dt>
            <MacroBadge macro={m.key} />
          </dt>
          <dd className="num text-[15px] font-semibold">{fmtG(macros[m.key])} g</dd>
        </div>
      ))}
    </dl>
  );
}

type BarState = "none" | "under" | "hit" | "over";

/** Where a macro stands against its target. */
export function barState(macro: GramMacro, eaten: number, target: number | null): BarState {
  if (target == null || target <= 0) return "none";
  if (eaten > target && MACRO_UI_BY_KEY[macro].kind === "limit") return "over";
  if (eaten >= target) return "hit";
  return "under";
}

const pct = (n: number, of: number) => Math.max(0, Math.min(100, (n / of) * 100));

/**
 * One macro's bar. Under target: plain fill. Planned-but-not-eaten: hatched
 * extension. Target hit: full bar (the ✓ sits next to the label). Over a
 * limit: red hatch.
 */
export function MacroBar({
  macro,
  eaten,
  planned = 0,
  target,
  size = "md",
  className,
}: {
  macro: GramMacro;
  eaten: number;
  planned?: number;
  target: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const m = MACRO_UI_BY_KEY[macro];
  const state = barState(macro, eaten, target);
  const t = target ?? 0;
  const fill = state === "none" ? 0 : pct(eaten, t);
  const plan = state === "none" || state === "over" ? 0 : Math.max(0, pct(eaten + planned, t) - fill);
  return (
    <div
      className={cn(
        "bar",
        m.cls,
        size === "sm" && "thin",
        size === "lg" && "thick",
        state === "over" && "over",
        className,
      )}
      aria-hidden
    >
      <i style={{ width: `${state === "over" ? 100 : fill}%` }} />
      {plan > 0 && <i className="plan" style={{ left: `${fill}%`, width: `${plan}%` }} />}
    </div>
  );
}

/** "+14 g over" tag for a blown limit. */
export function OverTag({ grams }: { grams: number }) {
  return (
    <span className="tag bg-bad-t text-bad">+{fmtG(grams)} g over</span>
  );
}

/**
 * Kcal ring. Solid arc = eaten, faint arc = planned on top. The centre shows
 * what's left ("N over" past the target, never a negative number).
 */
export function KcalRing({
  eaten,
  planned = 0,
  target,
  size = 132,
  stroke = 12,
  compactLabel = false,
}: {
  eaten: number;
  planned?: number;
  target: number | null;
  size?: number;
  stroke?: number;
  /** Home's smaller ring: just the number and "left". */
  compactLabel?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const hasTarget = target != null && target > 0;
  const left = hasTarget ? target - eaten : 0;
  const over = hasTarget && left < 0;
  const eatenFrac = hasTarget ? Math.min(1, eaten / target) : 0;
  const planFrac = hasTarget ? Math.min(1, (eaten + planned) / target) - eatenFrac : 0;

  const summary = hasTarget
    ? over
      ? `${fmtKcal(-left)} kcal over a target of ${fmtKcal(target)}`
      : `${fmtKcal(left)} kcal left of ${fmtKcal(target)}; ${fmtKcal(eaten)} eaten${planned > 0 ? `, ${fmtKcal(planned)} planned` : ""}`
    : `${fmtKcal(eaten)} kcal eaten`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={summary}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="var(--track)" />
        {planFrac > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            stroke="var(--kcal)"
            strokeOpacity={0.28}
            strokeDasharray={`${c * planFrac} ${c}`}
            strokeDashoffset={-c * eatenFrac}
            className="transition-[stroke-dasharray,stroke-dashoffset] duration-300"
          />
        )}
        {eatenFrac > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={over ? "var(--bad)" : "var(--kcal)"}
            strokeDasharray={`${c * eatenFrac} ${c}`}
            className="transition-[stroke-dasharray] duration-300"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={cn("num font-semibold leading-none", over && "text-bad")}
          style={{ fontSize: Math.round(size * 0.23) }}
        >
          {fmtKcal(hasTarget ? Math.abs(left) : eaten)}
        </span>
        <span className="mt-1 text-xs leading-tight text-ink-2">
          {!hasTarget ? "kcal eaten" : over ? "kcal over" : compactLabel ? "left" : "kcal left"}
          {hasTarget && !compactLabel && (
            <>
              <br />
              of {fmtKcal(target)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/** Label + value + bar for one macro, as in the summary grid. */
function MacroCell({
  macro,
  eaten,
  planned,
  target,
}: {
  macro: GramMacro;
  eaten: number;
  planned: number;
  target: number | null;
}) {
  const state = barState(macro, eaten, target);
  return (
    <div className="min-w-0">
      <MacroBadge macro={macro} className="mb-0.5 flex" />
      <div className="mb-1 flex items-center gap-1.5">
        <span className="num text-[15px] font-semibold">{fmtG(eaten)}</span>
        {target != null && <span className="text-xs text-ink-3">/{fmtG(target)}</span>}
        {state === "hit" && <Check className="size-3.5 text-good" aria-label="target hit" />}
      </div>
      <MacroBar macro={macro} eaten={eaten} planned={planned} target={target} />
      {state === "over" && target != null && (
        <span className="mt-1 inline-block text-xs font-semibold text-bad">
          +{fmtG(eaten - target)} g over
        </span>
      )}
    </div>
  );
}

/**
 * Full summary: kcal ring + protein hero + 2×2 grid of the rest.
 */
export function MacroSummaryFull({
  eaten,
  planned,
  targets,
  className,
}: {
  eaten: Macros;
  planned: Macros;
  targets: Targets;
  className?: string;
}) {
  const pTarget = targets.protein;
  const pState = barState("protein", eaten.protein, pTarget);
  const pLeft = pTarget != null ? pTarget - eaten.protein : null;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <KcalRing eaten={eaten.kcal} planned={planned.kcal} target={targets.kcal} />
      <div className="min-w-0 flex-1">
        <MacroBadge macro="protein" className="mb-1 flex text-[13px]" />
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="num text-[22px] font-semibold leading-none">{fmtG(eaten.protein)}</span>
          {pTarget != null && <span className="text-sm text-ink-3">/ {fmtG(pTarget)} g</span>}
          <span className="ml-auto text-sm font-semibold">
            {pState === "hit" ? (
              <span className="inline-flex items-center gap-1 text-good">
                <Check className="size-4" /> hit
              </span>
            ) : pLeft != null ? (
              `${fmtG(pLeft)} left`
            ) : null}
          </span>
        </div>
        <MacroBar macro="protein" eaten={eaten.protein} planned={planned.protein} target={pTarget} size="lg" />
        <div className="mt-3.5 grid grid-cols-2 gap-x-3.5 gap-y-3">
          {MACROS_UI.slice(1).map((m) => (
            <MacroCell
              key={m.key}
              macro={m.key}
              eaten={eaten[m.key]}
              planned={planned[m.key]}
              target={targets[m.key]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Compact strip: "1,532 / 2,600 kcal · 1,068 left" over five small bars. */
export function MacroStrip({
  eaten,
  planned,
  targets,
  className,
}: {
  eaten: Macros;
  planned: Macros;
  targets: Targets;
  className?: string;
}) {
  const kt = targets.kcal;
  const left = kt != null ? kt - eaten.kcal : null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-lg font-semibold leading-none">{fmtKcal(eaten.kcal)}</span>
        <span className="text-sm text-ink-3">{kt != null ? `/ ${fmtKcal(kt)} kcal` : "kcal"}</span>
        {left != null && (
          <span className={cn("ml-auto text-sm font-semibold", left < 0 && "text-bad")}>
            {left < 0 ? `${fmtKcal(-left)} over` : `${fmtKcal(left)} left`}
          </span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {MACROS_UI.map((m) => (
          <div key={m.key} className="min-w-0">
            <p className="mb-0.5 truncate text-[11px] font-semibold leading-tight text-ink-2">{m.label}</p>
            <p className="mb-1 truncate text-[11px] font-semibold leading-none">
              <span className="num">{fmtG(eaten[m.key])}</span>
              {m.key === "protein" && targets.protein != null && (
                <span className="text-ink-3">/{fmtG(targets.protein)}</span>
              )}
            </p>
            <MacroBar
              macro={m.key}
              eaten={eaten[m.key]}
              planned={planned[m.key]}
              target={targets[m.key]}
              size="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
