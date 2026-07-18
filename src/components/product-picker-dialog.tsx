"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Package, ScanBarcode, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PickerProduct } from "@/components/add-product-dialog";

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
  onPick,
  onClose,
}: {
  products: PickerProduct[];
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

  const results = useMemo(() => {
    const q = query.trim();
    const list = q ? products.filter((p) => matches(p, q)) : products;
    return list.slice(0, 50);
  }, [products, query]);

  function pick(p: PickerProduct) {
    onPick(p);
    setAdded(p.name);
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add from your products"
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-lg sm:max-w-md sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
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
                ? "No products yet. Add products from the Food tab first."
                : `Nothing matches “${query.trim()}”.`}
            </p>
          ) : (
            <div className="flex flex-col">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className="flex min-h-14 items-center gap-3 border-b border-border px-4 text-left last:border-b-0 active:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {p.barcode ? (
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
