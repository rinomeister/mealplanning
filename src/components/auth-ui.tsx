"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const authField =
  "h-[52px] w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] outline-none focus:border-2 focus:border-ink";

/** The app mark: a kcal ring in the protein, carb and fat colours. */
export function AppMark() {
  return (
    <svg viewBox="0 0 56 56" className="size-14" aria-hidden>
      <circle cx="28" cy="28" r="20" fill="none" stroke="var(--track)" strokeWidth="7" />
      {[
        ["var(--pro)", 0, 0.38],
        ["var(--carb)", 0.42, 0.7],
        ["var(--fat)", 0.74, 0.92],
      ].map(([c, a, b]) => {
        const len = 2 * Math.PI * 20;
        return (
          <circle
            key={c as string}
            cx="28"
            cy="28"
            r="20"
            fill="none"
            stroke={c as string}
            strokeWidth="7"
            strokeDasharray={`${((b as number) - (a as number)) * len} ${len}`}
            strokeDashoffset={-(a as number) * len}
            transform="rotate(-90 28 28)"
          />
        );
      })}
    </svg>
  );
}

/** Password input with a show/hide eye, and an optional strength meter. */
export function PasswordField({ autoComplete, meter = false }: { autoComplete: string; meter?: boolean }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  const score = value.length === 0 ? 0 : value.length < 8 ? 1 : value.length >= 12 && /[^a-zA-Z]/.test(value) ? 3 : 2;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="password" className="text-[13px] font-semibold text-ink-2">
        Password
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          enterKeyHint="go"
          minLength={meter ? 8 : undefined}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={cn(authField, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-ink-2"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {meter && (
        <>
          <div className="mt-1 grid grid-cols-3 gap-1.5" aria-hidden>
            {[1, 2, 3].map((i) => (
              <i
                key={i}
                className="block h-1 rounded-full"
                style={{ background: score >= i ? (score === 1 ? "var(--bad)" : "var(--good)") : "var(--track)" }}
              />
            ))}
          </div>
          <p className="text-[13px] text-ink-3" aria-live="polite">
            {score === 0 || score === 1 ? "At least 8 characters" : score === 2 ? "Good. Longer with a number or symbol is stronger." : "Strong password"}
          </p>
        </>
      )}
    </div>
  );
}
