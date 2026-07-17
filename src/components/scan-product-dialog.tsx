"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacroSummary } from "@/components/macro-summary";
import { BarcodeCamera } from "@/components/barcode-camera";
import { parseDecimal } from "@/lib/utils";
import { hasAnyMacro, scaleGrams, type MealMacros } from "@/lib/macros";
import { upsertProductMacrosAction } from "@/app/(app)/track/actions";
import type { BarcodeLookupResult } from "@/lib/barcode";

type FoundResult = Extract<BarcodeLookupResult, { found: true }>;

/** A resolved product plus the eaten/used weight, handed to the caller. */
export type ScannedProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  servingLabel: string | null;
  servingGrams: number | null;
  per100g: MealMacros;
};

const MACRO_FIELDS: { key: keyof MealMacros; label: string }[] = [
  { key: "kcal", label: "kcal" },
  { key: "protein", label: "Protein g" },
  { key: "fat", label: "Fat g" },
  { key: "carbs", label: "Carbs g" },
  { key: "sugar", label: "Sugar g" },
  { key: "fiber", label: "Fiber g" },
];

function toStr(v: number | null): string {
  return v == null ? "" : String(v);
}

type Phase = "scan" | "looking-up" | "found" | "not-found" | "error";

/**
 * Scan (or manually enter) a barcode, resolve it against our DB / Open Food
 * Facts, optionally correct its macros (persisted to the shared Product), enter
 * a weight in grams, and hand the resolved product + grams back via `onConfirm`.
 * Reused by daily tracking (log to a slot) and the meal builder (add ingredient).
 */
export function ScanProductDialog({
  title,
  confirmLabel,
  gramsLabel = "How many grams?",
  onConfirm,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  gramsLabel?: string;
  onConfirm: (product: ScannedProduct, grams: number) => boolean | Promise<boolean>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("scan");
  const [message, setMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [code, setCode] = useState("");

  const [name, setName] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [servingLabel, setServingLabel] = useState<string | null>(null);
  const [servingGrams, setServingGrams] = useState<number | null>(null);
  const [per100g, setPer100g] = useState<MealMacros>({
    kcal: null,
    protein: null,
    fat: null,
    carbs: null,
    sugar: null,
    fiber: null,
  });

  const [grams, setGrams] = useState("100");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editServingGrams, setEditServingGrams] = useState("");
  const [editMacros, setEditMacros] = useState<Record<string, string>>({});

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadFound = useCallback((r: FoundResult) => {
    setCode(r.code);
    setName(r.name);
    setBrand(r.brand);
    setServingLabel(r.servingLabel);
    setServingGrams(r.servingGrams);
    setPer100g(r.per100g);
    setGrams(String(r.servingGrams ?? 100));
    const missing = !hasAnyMacro(r.per100g);
    setEditing(missing);
    if (missing) {
      setEditName(r.name === "Unnamed product" ? "" : r.name);
      setEditServingGrams(toStr(r.servingGrams));
      setEditMacros({});
    }
    setPhase("found");
  }, []);

  const lookup = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!/^\d{6,14}$/.test(trimmed)) {
        setPhase("error");
        setMessage("That doesn't look like a valid barcode.");
        return;
      }
      setPhase("looking-up");
      setCode(trimmed);
      setMessage("");
      try {
        const res = await fetch(`/api/barcode/${trimmed}`);
        const data: BarcodeLookupResult = await res.json();
        if (data.found) {
          loadFound(data);
        } else {
          setName("");
          setBrand(null);
          setServingLabel(null);
          setServingGrams(null);
          setPer100g({ kcal: null, protein: null, fat: null, carbs: null, sugar: null, fiber: null });
          setEditName("");
          setEditServingGrams("");
          setEditMacros({});
          setEditing(true);
          setPhase("not-found");
        }
      } catch {
        setPhase("error");
        setMessage("Lookup failed. Check your connection and try again.");
      }
    },
    [loadFound],
  );

  function beginEdit() {
    setEditName(name === "Unnamed product" ? "" : name);
    setEditServingGrams(toStr(servingGrams));
    setEditMacros({
      kcal: toStr(per100g.kcal),
      protein: toStr(per100g.protein),
      fat: toStr(per100g.fat),
      carbs: toStr(per100g.carbs),
      sugar: toStr(per100g.sugar),
      fiber: toStr(per100g.fiber),
    });
    setEditing(true);
  }

  function readEditMacros(): MealMacros {
    const n = (k: string) => {
      const v = editMacros[k];
      if (v == null || v.trim() === "") return null;
      const parsed = parseDecimal(v);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      kcal: n("kcal"),
      protein: n("protein"),
      fat: n("fat"),
      carbs: n("carbs"),
      sugar: n("sugar"),
      fiber: n("fiber"),
    };
  }

  // Save corrected macros to our DB (source → "user") and update local state.
  function saveEdit(): Promise<boolean> {
    const nextName = editName.trim() || "Unnamed product";
    const sg = editServingGrams.trim() === "" ? null : parseDecimal(editServingGrams);
    const nextServingGrams = sg != null && Number.isFinite(sg) && sg > 0 ? sg : null;
    const nextMacros = readEditMacros();
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await upsertProductMacrosAction({
          barcode: code,
          name: nextName,
          brand,
          servingLabel,
          servingGrams: nextServingGrams,
          kcal: nextMacros.kcal,
          protein: nextMacros.protein,
          fat: nextMacros.fat,
          carbs: nextMacros.carbs,
          sugar: nextMacros.sugar,
          fiber: nextMacros.fiber,
        });
        if (res.ok) {
          setName(nextName);
          setServingGrams(nextServingGrams);
          setPer100g(nextMacros);
          setEditing(false);
          resolve(true);
        } else {
          setMessage(res.error);
          resolve(false);
        }
      });
    });
  }

  function confirm() {
    const g = parseDecimal(grams);
    if (!Number.isFinite(g) || g <= 0) {
      setMessage("Enter a weight in grams.");
      return;
    }
    startTransition(async () => {
      if (editing) {
        const ok = await saveEdit();
        if (!ok) return;
      }
      const product: ScannedProduct = {
        barcode: code,
        name: name || "Unnamed product",
        brand,
        servingLabel,
        servingGrams,
        per100g,
      };
      const ok = await onConfirm(product, g);
      if (ok) onClose();
      else if (!message) setMessage("Couldn't save — try again.");
    });
  }

  const gramsNum = parseDecimal(grams);
  const preview =
    Number.isFinite(gramsNum) && gramsNum > 0 ? scaleGrams(per100g, gramsNum) : null;
  const missingMacros = !hasAnyMacro(per100g);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-lg sm:max-w-md sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <p className="text-sm font-semibold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {(phase === "scan" || phase === "error") && (
            <>
              <BarcodeCamera onDetected={lookup} />
              {phase === "error" && message && (
                <p className="text-sm text-destructive">{message}</p>
              )}
              <form
                className="flex flex-col gap-2 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void lookup(manualCode);
                }}
              >
                <Label htmlFor="scan-manual">Or enter a barcode</Label>
                <div className="flex gap-2">
                  <Input
                    id="scan-manual"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 737628064502"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" disabled={manualCode.trim() === ""}>
                    Look up
                  </Button>
                </div>
              </form>
            </>
          )}

          {phase === "looking-up" && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Looking up {code}…
            </div>
          )}

          {(phase === "found" || phase === "not-found") && (
            <>
              {phase === "not-found" && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  We don&apos;t have barcode {code}. Add its details below to save it.
                </p>
              )}

              <div>
                <p className="font-semibold leading-tight">{name || "Unnamed product"}</p>
                {brand && <p className="text-sm text-muted-foreground">{brand}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">Barcode {code}</p>
              </div>

              {editing ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Macros per 100 g / ml
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-name" className="text-xs">Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Product name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MACRO_FIELDS.map((f) => (
                      <div key={f.key} className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground">{f.label}</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0"
                          value={editMacros[f.key] ?? ""}
                          onChange={(e) =>
                            setEditMacros((m) => ({ ...m, [f.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">1 serving = g</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="e.g. 30"
                        value={editServingGrams}
                        onChange={(e) => setEditServingGrams(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void saveEdit()}
                  >
                    {isPending && <Loader2 className="size-4 animate-spin" />}
                    Save macros
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Per 100 g / ml</p>
                    <button
                      type="button"
                      onClick={beginEdit}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Pencil className="size-3" /> Edit
                    </button>
                  </div>
                  <MacroSummary
                    macros={{
                      kcal: per100g.kcal ?? 0,
                      protein: per100g.protein ?? 0,
                      fat: per100g.fat ?? 0,
                      carbs: per100g.carbs ?? 0,
                      sugar: per100g.sugar ?? 0,
                      fiber: per100g.fiber ?? 0,
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Label htmlFor="grams">{gramsLabel}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="grams"
                    inputMode="decimal"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                  {servingGrams != null && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setGrams(String(servingGrams))}
                    >
                      1 serving ({servingGrams} g)
                    </Button>
                  )}
                </div>
                {preview && !missingMacros && (
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">
                      {scaleGramsLabel(gramsNum)}
                    </p>
                    <MacroSummary macros={preview} />
                  </div>
                )}
                {missingMacros && (
                  <p className="text-xs text-amber-600">
                    No macros entered — add them above so this counts.
                  </p>
                )}
              </div>

              {message && <p className="text-sm text-destructive">{message}</p>}

              <div className="flex gap-2">
                <Button type="button" className="flex-1" disabled={isPending} onClick={confirm}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {confirmLabel}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function scaleGramsLabel(grams: number): string {
  return `For ${grams} g`;
}
