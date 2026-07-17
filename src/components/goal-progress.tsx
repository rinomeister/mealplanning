import { cn } from "@/lib/utils";
import { MACRO_META, fmtMacro, type MacroKind, type Macros } from "@/lib/macros";

/**
 * Resolve a macro's state against its target once, so the ring and the bars
 * can't disagree about what "done" means.
 */
function status(consumed: number, target: number | null, kind: MacroKind) {
  if (target == null || target <= 0) {
    return { pct: 0, over: false, met: false, note: null as string | null };
  }
  const over = consumed > target;
  return {
    pct: Math.min(100, (consumed / target) * 100),
    // Only a ceiling can be blown; passing a floor is the goal, not a warning.
    over: over && kind === "limit",
    met: consumed >= target && kind === "goal",
    note: over
      ? `${fmtMacro(consumed - target, "g")} over`
      : `${fmtMacro(target - consumed, "g")} left`,
  };
}

/** Big kcal dial: the one number she checks at a glance. */
function KcalRing({ consumed, target }: { consumed: number; target: number | null }) {
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const s = status(consumed, target, "limit");
  const remaining = target != null ? target - consumed : 0;

  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          strokeWidth="11"
          className="stroke-muted"
        />
        {target != null && target > 0 && (
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            className={cn(s.over ? "stroke-destructive" : "stroke-primary")}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - s.pct / 100)}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {target != null ? (
          <>
            <span
              className={cn(
                "text-3xl font-bold leading-none tabular-nums",
                s.over && "text-destructive",
              )}
            >
              {fmtMacro(Math.abs(remaining), "kcal")}
            </span>
            <span
              className={cn(
                "mt-1 text-xs font-medium uppercase tracking-wide",
                s.over ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {s.over ? "over" : "left"}
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold leading-none tabular-nums">
              {fmtMacro(consumed, "kcal")}
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              kcal
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function MacroBar({
  label,
  color,
  kind,
  consumed,
  target,
}: {
  label: string;
  color: string;
  kind: MacroKind;
  consumed: number;
  target: number | null;
}) {
  const s = status(consumed, target, kind);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
        </span>
        <span className="text-sm tabular-nums">
          <span className={cn("font-semibold", s.over && "text-destructive")}>
            {fmtMacro(consumed, "g")}
          </span>
          <span className="text-muted-foreground">
            {target != null ? ` / ${Math.round(target)} g` : " g"}
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${target != null ? s.pct : 0}%`,
              backgroundColor: s.over ? "var(--destructive)" : color,
            }}
          />
        </div>
        {s.note && (
          <span
            className={cn(
              "w-[4.5rem] shrink-0 text-right text-xs tabular-nums",
              s.over && "text-destructive",
              s.met && "font-medium text-primary",
              !s.over && !s.met && "text-muted-foreground",
            )}
          >
            {s.met ? "goal met" : s.note}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Day totals against the user's daily targets: a kcal dial for the headline
 * number, then a bar per gram macro. Macros with no target set just show what
 * was eaten.
 */
export function GoalProgress({
  totals,
  targets,
}: {
  totals: Macros;
  targets: Partial<Record<keyof Macros, number | null>>;
}) {
  const kcalTarget = targets.kcal ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <KcalRing consumed={totals.kcal} target={kcalTarget} />
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold leading-none tabular-nums">
            {fmtMacro(totals.kcal, "kcal")}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {kcalTarget != null
              ? `eaten of ${Math.round(kcalTarget)} kcal`
              : "kcal eaten"}
          </p>
          {kcalTarget == null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Set a daily calorie goal in your profile to track what&apos;s left.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-x-6">
        {MACRO_META.map(({ key, label, color, kind }) => (
          <MacroBar
            key={key}
            label={label}
            color={color}
            kind={kind}
            consumed={totals[key]}
            target={targets[key] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
