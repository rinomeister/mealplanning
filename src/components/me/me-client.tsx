"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/units";
import { SCANNER_ENGINES, useScannerEngine } from "@/lib/scanner-pref";
import { useToast } from "@/components/toast";
import { applyDefaultTargetsAction, updateUnitsAction } from "@/app/(app)/me/actions";

/** Metric | Imperial. Only changes the display; storage stays metric. */
export function UnitsSetting({ units }: { units: UnitSystem }) {
  // Shows the tap right away; the server render catches up after refresh.
  const [choice, setChoice] = useState<UnitSystem | null>(null);
  const shown = choice ?? units;
  return (
    <div className="seg" role="radiogroup" aria-label="Units">
      {(
        [
          ["METRIC", "Metric"],
          ["IMPERIAL", "Imperial"],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={shown === v}
          className={cn(shown === v && "on")}
          onClick={() => {
            setChoice(v);
            void updateUnitsAction(v);
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function ScannerEngineName() {
  const engine = useScannerEngine();
  return <>{SCANNER_ENGINES.find((e) => e.value === engine)?.label}</>;
}

/** After sign-up: set targets here, or take the defaults and go. */
export function WelcomeCard() {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <div className="card flex flex-col gap-3 border-2 border-ink p-4">
      <div>
        <p className="text-[17px] font-semibold">Welcome! Set your daily targets</p>
        <p className="mt-0.5 text-sm text-ink-2">Tap any row below to set it. Or skip and start with sensible defaults; you can change them any time.</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            await applyDefaultTargetsAction();
            toast.show({ message: "Default targets set" });
            router.push("/");
          })
        }
        className="press flex h-12 items-center justify-center gap-2 rounded-btn bg-surface-2 font-semibold"
      >
        {busy && <Loader2 className="size-4 animate-spin" />} Skip, use defaults
      </button>
    </div>
  );
}
