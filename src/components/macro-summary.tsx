import { cn } from "@/lib/utils";
import { fmtMacro, type Macros } from "@/lib/macros";

const ITEMS: { key: keyof Macros; label: string; kind: "kcal" | "g" }[] = [
  { key: "kcal", label: "kcal", kind: "kcal" },
  { key: "protein", label: "Protein", kind: "g" },
  { key: "fat", label: "Fat", kind: "g" },
  { key: "carbs", label: "Carbs", kind: "g" },
];

export function MacroSummary({
  macros,
  targets,
  className,
}: {
  macros: Macros;
  targets?: Partial<Record<keyof Macros, number | null>>;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {ITEMS.map(({ key, label, kind }) => {
        const target = targets?.[key];
        return (
          <div
            key={key}
            className="rounded-lg bg-muted/60 px-2 py-2 text-center"
          >
            <p className="text-base font-semibold leading-tight">
              {fmtMacro(macros[key], kind)}
              {kind === "g" && <span className="text-xs font-normal">g</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {label}
              {target ? ` / ${Math.round(target)}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
