import { MACRO_META, fmtMacro, type Macros } from "@/lib/macros";

/**
 * The macro line that sits under a slot's title on /track. Dot colours match
 * the day-total bars above, so "the purple one" means carbs everywhere.
 */
export function SlotMacros({ macros }: { macros: Macros }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
      {MACRO_META.map(({ key, label, color }) => (
        <span
          key={key}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
          <span className="font-semibold text-foreground">
            {fmtMacro(macros[key], "g")}g
          </span>
        </span>
      ))}
    </div>
  );
}
