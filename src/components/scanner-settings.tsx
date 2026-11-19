"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { FlowScreen } from "@/components/add/flow-screen";
import { BarcodeCamera } from "@/components/barcode-camera";
import { SCANNER_ENGINES, setScannerEngine, useScannerEngine } from "@/lib/scanner-pref";
import { cn } from "@/lib/utils";

/** Me → Scanner engine: pick the barcode engine for this device, and try it. */
export function ScannerSettings() {
  const router = useRouter();
  const engine = useScannerEngine();
  const [testing, setTesting] = useState(false);
  const [lastRead, setLastRead] = useState<string | null>(null);

  return (
    <FlowScreen
      top={
        <div className="flex items-center gap-1 pb-2">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="-ml-2 grid size-11 place-items-center rounded-full">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="t-h2">Scanner engine</h1>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-8">
        <p className="text-ink-2">If scanning doesn&apos;t pick up barcodes on this phone, switch engine. Saved on this device only.</p>
        <div className="card divide-y divide-line overflow-hidden" role="radiogroup" aria-label="Scanner engine">
          {SCANNER_ENGINES.map((e) => {
            const on = engine === e.value;
            return (
              <button
                key={e.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setScannerEngine(e.value);
                  setLastRead(null);
                }}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{e.label}</span>
                  <span className="block text-[13px] text-ink-3">{e.hint}</span>
                </span>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2", on ? "border-ink bg-ink text-inv" : "border-line")}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {testing ? (
          <div className="card flex flex-col gap-2 p-3">
            {/* key remounts the camera when the engine changes mid-test */}
            <BarcodeCamera key={engine} onDetected={setLastRead} />
            <p className="text-center text-sm text-ink-2" aria-live="polite">
              {lastRead ? (
                <>
                  Read <span className="num font-semibold text-ink">{lastRead}</span> ✓
                </>
              ) : (
                "Point the camera at a barcode."
              )}
            </p>
            <button type="button" onClick={() => setTesting(false)} className="h-11 font-semibold">
              Done testing
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setTesting(true)} className="press flex h-12 items-center justify-center rounded-btn bg-surface-2 font-semibold">
            Test the scanner
          </button>
        )}
      </div>
    </FlowScreen>
  );
}
