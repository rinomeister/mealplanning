"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, History, Package, ScanBarcode, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OffSearchPanel } from "@/components/off-search-panel";
import type { PickerProduct } from "@/lib/products";
import { Modal } from "@/components/ui/modal";
import { EMPTY_USAGE, groupByUsage, type Usage } from "@/lib/usage";

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
 * Search the products already in the database and drop them straight into the
 * meal you're building as ingredients. Stays open after each pick so several
 * stored products can be added in one go; each one lands as an editable row.
 */
export function ProductPickerDialog({
  products,
  usage = EMPTY_USAGE,
  onPick,
  onClose,
}: {
  products: PickerProduct[];
  /** Favorites and recents float to the top when nothing is typed. */
  usage?: Usage;
  onPick: (product: PickerProduct) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const favSet = useMemo(() => new Set(usage.favoriteIds), [usage]);
  const { results, firstRestIndex, recentCount } = useMemo(() => {
    const q = query.trim();
    if (q) {
      const hits = products.filter((p) => matches(p, q));
      hits.sort((a, b) => Number(favSet.has(b.id)) - Number(favSet.has(a.id)));
      return { results: hits.slice(0, 50), firstRestIndex: -1, recentCount: 0 };
    }
    const g = groupByUsage(products, usage);
    const top = [...g.favorites, ...g.recent];
    return {
      results: [...top, ...g.rest].slice(0, 50 + top.length),
      firstRestIndex: top.length > 0 ? top.length : -1,
      recentCount: g.recent.length,
    };
  }, [products, query, usage, favSet]);

  function pick(p: PickerProduct) {
    onPick(p);
    setAdded(p.name);
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <Modal onClose={onClose} label={"Add from your products"} className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <p className="flex-1 text-sm font-semibold">Add from your products</p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Done"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-border p-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAdded(null);
              }}
              placeholder="Search your products…"
              className="pl-9"
              autoComplete="off"
              autoFocus
            />
          </div>
          {added && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-primary">
              <Check className="size-4" /> Added “{added}” — search for another,
              or close.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {products.length === 0
                ? "No products yet — search Open Food Facts by typing a name."
                : `None of your products match “${query.trim()}”.`}
            </p>
          ) : (
            <div className="flex flex-col">
              {results.map((p, i) => (
                <div key={p.id} className="contents">
                {i === firstRestIndex && (
                  <p className="bg-muted/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                    All products
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="flex min-h-14 items-center gap-3 border-b border-border px-4 text-left last:border-b-0 active:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {favSet.has(p.id) ? (
                      <Star className="size-4 fill-amber-400 text-amber-400" />
                    ) : firstRestIndex > 0 && i < firstRestIndex && recentCount > 0 ? (
                      <History className="size-4" />
                    ) : p.barcode ? (
                      <ScanBarcode className="size-4" />
                    ) : (
                      <Package className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 py-2">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.brand && (
                      <p className="truncate text-xs text-muted-foreground">
                        {p.brand}
                      </p>
                    )}
                  </div>
                  {p.per100g.kcal != null && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {Math.round(p.per100g.kcal)} kcal/100g
                    </span>
                  )}
                </button>
                </div>
              ))}
            </div>
          )}
          <OffSearchPanel query={query} onPick={pick} />
        </div>
      </Modal>
  );
}
