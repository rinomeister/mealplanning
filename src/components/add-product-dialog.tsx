"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  History,
  Loader2,
  Plus,
  ScanBarcode,
  Search,
  Star,
  X,
} from "lucide-react";
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
import { fmtMacro, hasAnyMacro, scaleGrams } from "@/lib/macros";
import {
  createProductAction,
  setProductFavoriteAction,
} from "@/app/(app)/products/actions";
import { EMPTY_USAGE, groupByUsage, type Usage } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { OffSearchPanel } from "@/components/off-search-panel";
import { PortionChips } from "@/components/portion-chips";
import { Modal } from "@/components/ui/modal";
import type { PickerProduct } from "@/lib/products";

export type { PickerProduct };

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
  usage = EMPTY_USAGE,
  onLog,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  products: PickerProduct[];
  /** Recents, last amounts and stars, for the shortcuts at the top. */
  usage?: Usage;
  onLog: (productId: string, grams: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickerProduct | null>(null);
  const [grams, setGrams] = useState("100");
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [message, setMessage] = useState("");
  const [favorites, setFavorites] = useState<string[]>(usage.favoriteIds);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim();
  const sections = useMemo(() => {
    if (q) {
      // Searching: one list, starred matches first.
      const fav = new Set(favorites);
      const hits = products.filter((p) => matches(p, q));
      hits.sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)));
      return [{ key: "hits", title: null, items: hits.slice(0, 50) }];
    }
    const g = groupByUsage(products, { ...usage, favoriteIds: favorites });
    return [
      { key: "fav", title: "Favorites", items: g.favorites },
      { key: "recent", title: "Recent", items: g.recent },
      {
        key: "all",
        title: g.favorites.length + g.recent.length > 0 ? "All products" : null,
        items: g.rest.slice(0, 50),
      },
    ].filter((sec) => sec.items.length > 0);
  }, [products, q, usage, favorites]);
  const resultCount = sections.reduce((n, sec) => n + sec.items.length, 0);

  const lastGrams = (id: string) => usage.last[id]?.grams ?? null;

  function choose(p: PickerProduct) {
    setSelected(p);
    setGrams(String(lastGrams(p.id) ?? p.servingGrams ?? 100));
    setMessage("");
    setPhase("detail");
  }

  /** One tap from the list: log the same amount as last time. */
  function logAgain(p: PickerProduct, g: number) {
    setQuickId(p.id);
    startTransition(async () => {
      const ok = await onLog(p.id, g);
      setQuickId(null);
      if (ok) onClose();
      else setMessage("Couldn't log it — try again.");
    });
  }

  function toggleFavorite(id: string) {
    const on = !favorites.includes(id);
    setFavorites((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
    startTransition(async () => {
      const res = await setProductFavoriteAction(id, on);
      if (!res.ok) {
        setFavorites((prev) => (on ? prev.filter((x) => x !== id) : [...prev, id]));
      }
    });
  }

  function beginCreate() {
    // Carry the search text over as the name — they've already typed it once.
    setDraft({ ...EMPTY_DRAFT, name: q });
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
        portions: input.portions,
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
    <Modal onClose={onClose} label={title} className="overflow-hidden">
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
          {phase === "detail" && selected && (
            <button
              type="button"
              onClick={() => toggleFavorite(selected.id)}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label={
                favorites.includes(selected.id) ? "Remove from favorites" : "Add to favorites"
              }
              aria-pressed={favorites.includes(selected.id)}
            >
              <Star
                className={cn(
                  "size-5",
                  favorites.includes(selected.id) && "fill-amber-400 text-amber-400",
                )}
              />
            </button>
          )}
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
              {message && (
                <p className="px-4 pt-3 text-sm text-destructive">{message}</p>
              )}
              {resultCount === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {products.length === 0
                    ? "No products yet. Search Open Food Facts or add one below."
                    : `None of your products match “${q}”.`}
                </p>
              ) : (
                sections.map((sec) => (
                  <div key={sec.key} className="flex flex-col">
                    {sec.title && (
                      <p className="flex items-center gap-1.5 bg-muted/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                        {sec.key === "fav" && <Star className="size-3.5" />}
                        {sec.key === "recent" && <History className="size-3.5" />}
                        {sec.title}
                      </p>
                    )}
                    {sec.items.map((p) => {
                      const again = lastGrams(p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex min-h-14 items-center border-b border-border last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => choose(p)}
                            className="flex min-w-0 flex-1 items-center gap-3 self-stretch px-4 text-left active:bg-muted"
                          >
                            <div className="min-w-0 flex-1 py-2">
                              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                                {favorites.includes(p.id) && (
                                  <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                                )}
                                <span className="truncate">{p.name}</span>
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {[
                                  p.brand,
                                  p.per100g.kcal != null
                                    ? `${Math.round(p.per100g.kcal)} kcal/100g`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            {p.barcode && again == null && (
                              <ScanBarcode
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-label="Scanned"
                              />
                            )}
                          </button>
                          {again != null && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => logAgain(p, again)}
                              className="mr-3 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-primary active:bg-muted disabled:opacity-60"
                              aria-label={`Log ${fmtMacro(again)} g of ${p.name} again`}
                            >
                              {quickId === p.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Plus className="size-3.5" />
                              )}
                              {fmtMacro(again)} g
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <OffSearchPanel query={query} onPick={choose} />
            </div>

            <div className="border-t border-border p-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={beginCreate}
              >
                <Plus />
                {q ? `Add “${q}”` : "Add a new product"}
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
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="add-grams">How much did you eat? (grams)</Label>
                {lastGrams(selected.id) != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Last time {fmtMacro(lastGrams(selected.id)!)} g
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="add-grams"
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">g</span>
              </div>
              <PortionChips
                servingGrams={selected.servingGrams}
                portions={selected.portions}
                grams={grams}
                onGrams={setGrams}
              />
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
      </Modal>
  );
}
