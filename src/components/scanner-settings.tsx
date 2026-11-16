"use client";

import { useState } from "react";
import { Check, ScanBarcode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeCamera } from "@/components/barcode-camera";
import {
  SCANNER_ENGINES,
  setScannerEngine,
  useScannerEngine,
} from "@/lib/scanner-pref";
import { cn } from "@/lib/utils";

/** Profile card: pick the barcode engine for this device, and try it out. */
export function ScannerSettings() {
  const engine = useScannerEngine();
  const [testing, setTesting] = useState(false);
  const [lastRead, setLastRead] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanBarcode className="size-5" />
          Barcode scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-sm text-muted-foreground">
          If scanning doesn&apos;t pick up barcodes on this phone, switch engine. Saved
          on this device only.
        </p>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Scanner engine">
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
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  on ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{e.label}</span>
                  <span className="block text-xs text-muted-foreground">{e.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {testing ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {/* key remounts the camera when the engine changes mid-test */}
            <BarcodeCamera key={engine} onDetected={setLastRead} />
            {lastRead && (
              <p className="text-center text-sm">
                Read <span className="font-mono font-medium">{lastRead}</span> ✓
              </p>
            )}
            <button
              type="button"
              onClick={() => setTesting(false)}
              className="text-sm text-muted-foreground hover:underline"
            >
              Done testing
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTesting(true)}
            className="self-start text-sm font-medium text-primary hover:underline"
          >
            Test the scanner
          </button>
        )}
      </CardContent>
    </Card>
  );
}
