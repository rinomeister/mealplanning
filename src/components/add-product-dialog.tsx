"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, Loader2, Plus, ScanBarcode, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacroSummary } from "@/components/macro-summary";
import {
  EMPTY_DRAFT,
  ProductFields,
  draftToInput,
  type ProductDraft,
} from "@/components/product-fields";
import { parseDecimal } from "@/lib/utils";
import { hasAnyMacro, scaleGrams, type MealMacros } from "@/lib/macros";
import { createProductAction } from "@/app/(app)/products/actions";

/** A product from our own database, as shown in the picker. */
export type PickerProduct = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingGrams: number | null;
  per100g: MealMacros;
};

type Phase = "search" | "detail" | "create";

/** Case-insensitive match across name and brand, so "cekin" finds the brand. */
function matches(p: PickerProduct, q: string): boolean {
  const hay = `${p.name} ${p.brand ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

/**
 * Pick a food from the products we already hold, or type in a new one, then log
 * a weight of it. This is the no-barcode path: butcher's meat, loose produce, or
 * anything whose packaging is long gone. Everything entered here is saved, so
 * each food only has to be typed once.
 */
export function AddProductDialog({
  title,
  confirmLabel,
  products,
  onLog,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  products: PickerProduct[];
  onLog: (productId: string, grams: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickerProduct | null>(null);
  const [grams, setGrams] = useState("100");
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim();
    const list = q ? products.filter((p) => matches(p, q)) : products;
    return list.slice(0, 50);
  }, [products, query]);

  function choose(p: PickerProduct) {
    setSelected(p);
    setGrams(String(p.servingGrams ?? 100));
    setMessage("");
    setPhase("detail");
  }

  function beginCreate() {
    // Carry the search text over as the name — they've already typed it once.
    setDraft({ ...EMPTY_DRAFT, name: query.trim() });
    setMessage("");
    setPhase("create");
  }

  function saveNew() {
    const input = draftToInput(draft);
    if (!input.name) {
      setMessage("Give it a name.");
      return;
    }
    startTransition(async () => {
      const res = await createProductAction(input);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      choose({
        id: res.id,
        name: input.name,
        brand: input.brand ?? null,
        barcode: null,
        servingGrams: input.servingGrams ?? null,
        per100g: {
          kcal: input.kcal ?? null,
          protein: input.protein ?? null,
          fat: input.fat ?? null,
          carbs: input.carbs ?? null,
          sugar: input.sugar ?? null,
          fiber: input.fiber ?? null,
        },
      });
    });
  }

  function confirm() {
    if (!selected) return;
    const g = parseDecimal(grams);
    if (!Number.isFinite(g) || g <= 0) {
      setMessage("Enter a weight in grams.");
      return;
    }
    startTransition(async () => {
      const ok = await onLog(selected.id, g);
      if (ok) onClose();
      else setMessage("Couldn't log it — try again.");
    });
  }

  const gramsNum = parseDecimal(grams);
  const preview =
    selected && Number.isFinite(gramsNum) && gramsNum > 0
      ? scaleGrams(selected.per100g, gramsNum)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-lg sm:max-w-md sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border p-4">
          {phase !== "search" && (
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setPhase("search");
              }}
              className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Back"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <p className="flex-1 text-sm font-semibold">
            {phase === "create" ? "New product" : title}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {phase === "search" && (
          <>
            <div className="border-b border-border p-4 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your products…"
                  className="pl-9"
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {products.length === 0
                    ? "No products yet. Add your first one below."
                    : `Nothing matches “${query.trim()}”.`}
                </p>
              ) : (
                <div className="flex flex-col">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => choose(p)}
                      className="flex min-h-14 items-center gap-3 border-b border-border px-4 text-left last:border-b-0 active:bg-muted"
                    >
                      <div className="min-w-0 flex-1 py-2">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        {p.brand && (
                          <p className="truncate text-xs text-muted-foreground">
                            {p.brand}
                          </p>
                        )}
                      </div>
                      {p.barcode && (
                        <ScanBarcode
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label="Scanned"
                        />
                      )}
                      {p.per100g.kcal != null && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {Math.round(p.per100g.kcal)} kcal/100g
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border p-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={beginCreate}
              >
                <Plus />
                {query.trim() ? `Add “${query.trim()}”` : "Add a new product"}
              </Button>
            </div>
          </>
        )}

        {phase === "create" && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">
              Copy the values off the package or your own notes. You only have to
              do this once — it&apos;s saved to your products.
            </p>
            <ProductFields draft={draft} onChange={setDraft} />
            {message && <p className="text-sm text-destructive">{message}</p>}
            <Button type="button" disabled={isPending} onClick={saveNew}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save and continue
            </Button>
          </div>
        )}

        {phase === "detail" && selected && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div>
              <p className="font-semibold leading-tight">{selected.name}</p>
              {selected.brand && (
                <p className="text-sm text-muted-foreground">{selected.brand}</p>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Per 100 g / ml
              </p>
              <MacroSummary
                macros={{
                  kcal: selected.per100g.kcal ?? 0,
                  protein: selected.per100g.protein ?? 0,
                  fat: selected.per100g.fat ?? 0,
                  carbs: selected.per100g.carbs ?? 0,
                  sugar: selected.per100g.sugar ?? 0,
                  fiber: selected.per100g.fiber ?? 0,
                }}
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <Label htmlFor="add-grams">How much did you eat? (grams)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="add-grams"
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">g</span>
                {selected.servingGrams != null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGrams(String(selected.servingGrams))}
                  >
                    1 serving ({selected.servingGrams} g)
                  </Button>
                )}
              </div>
              {preview && hasAnyMacro(selected.per100g) && (
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    For {gramsNum} g
                  </p>
                  <MacroSummary macros={preview} />
                </div>
              )}
              {!hasAnyMacro(selected.per100g) && (
                <p className="text-xs text-amber-600">
                  This product has no macros, so it won&apos;t count toward your
                  totals. Edit it on the Products page to fix that.
                </p>
              )}
            </div>

            {message && <p className="text-sm text-destructive">{message}</p>}

            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={isPending}
                onClick={confirm}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {confirmLabel}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
