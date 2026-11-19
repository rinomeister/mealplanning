"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";

/**
 * − value + . Tap the value to type it; hold − / + to repeat. The value is a
 * string so a half-typed "1," survives; the parent parses it.
 */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  unit,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  step: number;
  min?: number;
  unit?: string;
  label: string;
  className?: string;
}) {
  const repeat = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);

  function bump(dir: 1 | -1) {
    const n = parseDecimal(current.current);
    const base = Number.isFinite(n) ? n : 0;
    // Snap to the step grid so 147 + 5 → 150, not 152.
    const snapped = dir > 0 ? Math.floor(base / step + 1e-9) * step + step : Math.ceil(base / step - 1e-9) * step - step;
    const next = Math.max(min, Math.round(snapped * 100) / 100);
    current.current = String(next);
    onChange(String(next));
  }

  function hold(dir: 1 | -1) {
    bump(dir);
    let delay = 400;
    const go = () => {
      bump(dir);
      delay = Math.max(60, delay * 0.8);
      repeat.current = setTimeout(go, delay);
    };
    repeat.current = setTimeout(go, delay);
  }
  const release = () => clearTimeout(repeat.current);

  const btn =
    "press grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.06)] select-none touch-none";

  return (
    <div className={cn("flex h-[52px] items-center rounded-btn bg-surface-2 p-1", className)}>
      <button
        type="button"
        className={btn}
        aria-label={`Less ${label}`}
        onPointerDown={(e) => {
          e.preventDefault();
          hold(-1);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && bump(-1)}
      >
        <Minus className="size-5" />
      </button>
      <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <span className="sr-only">{label}</span>
        <input
          inputMode="decimal"
          enterKeyHint="done"
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(e.target.value)}
          className={cn("num min-w-0 bg-transparent text-[22px] font-semibold outline-none", unit ? "w-20 text-right" : "w-full text-center")}
        />
        {unit && <span className="w-16 truncate text-sm text-ink-3">{unit}</span>}
      </label>
      <button
        type="button"
        className={btn}
        aria-label={`More ${label}`}
        onPointerDown={(e) => {
          e.preventDefault();
          hold(1);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && bump(1)}
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}
