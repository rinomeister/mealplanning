"use client";

import { useCallback, useState } from "react";
import { ScanBarcode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacroSummary } from "@/components/macro-summary";
import { BarcodeCamera } from "@/components/barcode-camera";
import type { BarcodeLookupResult } from "@/lib/barcode";
import type { Macros, MealMacros } from "@/lib/macros";

type FoundResult = Extract<BarcodeLookupResult, { found: true }>;

type Status = "idle" | "looking-up" | "result" | "not-found" | "error";

/** Fill in missing macro fields with 0 so MacroSummary (needs non-null) renders. */
function toMacros(m: MealMacros): Macros {
  return {
    kcal: m.kcal ?? 0,
    protein: m.protein ?? 0,
    fat: m.fat ?? 0,
    carbs: m.carbs ?? 0,
    sugar: m.sugar ?? 0,
    fiber: m.fiber ?? 0,
  };
}

export function BarcodeScanner() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<FoundResult | null>(null);
  const [message, setMessage] = useState<string>("");
  const [lastCode, setLastCode] = useState<string>("");
  const [manualCode, setManualCode] = useState<string>("");

  const lookup = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!/^\d{6,14}$/.test(trimmed)) {
      setStatus("error");
      setMessage("That doesn't look like a valid barcode.");
      return;
    }
    setLastCode(trimmed);
    setStatus("looking-up");
    setMessage("");
    try {
      const res = await fetch(`/api/barcode/${trimmed}`);
      const data: BarcodeLookupResult = await res.json();
      if (data.found) {
        setResult(data);
        setStatus("result");
      } else {
        setStatus("not-found");
        setMessage(data.error ?? "");
      }
    } catch {
      setStatus("error");
      setMessage("Lookup failed. Check your connection and try again.");
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setMessage("");
    setLastCode("");
    setManualCode("");
    setStatus("idle");
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanBarcode className="size-5" />
          Barcode lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {status !== "result" && status !== "looking-up" && (
          <BarcodeCamera onDetected={lookup} />
        )}

        {status === "looking-up" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Looking up {lastCode}…
          </div>
        )}

        {status === "result" && result && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-semibold leading-tight">{result.name}</p>
              {result.brand && (
                <p className="text-sm text-muted-foreground">{result.brand}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                Barcode {result.code}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Per 100 g / ml
              </p>
              <MacroSummary macros={toMacros(result.per100g)} />
            </div>

            {result.perServing && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Per serving{result.servingLabel ? ` (${result.servingLabel})` : ""}
                </p>
                <MacroSummary macros={toMacros(result.perServing)} />
              </div>
            )}

            <Button type="button" variant="outline" onClick={reset}>
              <ScanBarcode className="size-4" />
              Scan another
            </Button>
          </div>
        )}

        {status === "not-found" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              No nutrition data found for barcode{" "}
              <span className="font-medium">{lastCode}</span>.
              {message ? ` ${message}` : ""}
            </p>
            <Button type="button" variant="outline" onClick={reset}>
              Try another
            </Button>
          </div>
        )}

        {status === "error" && message && (
          <p className="text-sm text-destructive">{message}</p>
        )}

        {/* Manual entry — always available, and the way to test without a camera. */}
        {status !== "result" && (
          <form
            className="flex flex-col gap-2 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(manualCode);
            }}
          >
            <Label htmlFor="manual-barcode">Or enter a barcode</Label>
            <div className="flex gap-2">
              <Input
                id="manual-barcode"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 737628064502"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={manualCode.trim() === "" || status === "looking-up"}
              >
                Look up
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
