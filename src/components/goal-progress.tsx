import { cn } from "@/lib/utils";
import { fmtMacro, type Macros } from "@/lib/macros";

const ITEMS: { key: keyof Macros; label: string; kind: "kcal" | "g" }[] = [
  { key: "kcal", label: "kcal", kind: "kcal" },
  { key: "protein", label: "Protein", kind: "g" },
  { key: "fat", label: "Fat", kind: "g" },
  { key: "carbs", label: "Carbs", kind: "g" },
  { key: "sugar", label: "Sugar", kind: "g" },
  { key: "fiber", label: "Fiber", kind: "g" },
];

/**
 * Day totals vs. the user's daily targets, per macro, with remaining / over.
 * Macros with no target set just show the consumed amount.
 */
export function GoalProgress({
  totals,
  targets,
}: {
  totals: Macros;
  targets: Partial<Record<keyof Macros, number | null>>;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {ITEMS.map(({ key, label, kind }) => {
        const consumed = totals[key];
        const target = targets[key] ?? null;
        const over = target != null && consumed > target;
        const pct =
          target && target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
        const remaining = target != null ? target - consumed : null;
        return (
          <div key={key} className="rounded-lg bg-muted/60 px-1.5 py-2 text-center">
            <p
              className={cn(
                "text-sm font-semibold leading-tight sm:text-base",
                over && "text-destructive",
              )}
            >
              {fmtMacro(consumed, kind)}
              {kind === "g" && <span className="text-xs font-normal">g</span>}
            </p>
            <p className="text-[10px] text-muted-foreground sm:text-[11px]">
              {label}
              {target != null ? ` / ${Math.round(target)}` : ""}
            </p>
            {target != null && (
              <>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      over ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${over ? 100 : pct}%` }}
                  />
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-[9px] sm:text-[10px]",
                    over ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {over
                    ? `${fmtMacro(consumed - target, kind)} over`
                    : `${fmtMacro(remaining ?? 0, kind)} left`}
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
