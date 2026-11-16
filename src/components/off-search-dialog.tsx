"use client";

import { useState } from "react";
import { Check, Globe, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { OffSearchPanel } from "@/components/off-search-panel";
import type { PickerProduct } from "@/lib/products";

/**
 * Search Open Food Facts by name. Each pick is saved to the shared products
 * (by barcode) and handed to `onPick`. Stays open so several can be added.
 */
export function OffSearchDialog({
  title = "Search Open Food Facts",
  onPick,
  onClose,
}: {
  title?: string;
  onPick: (product: PickerProduct) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<string[]>([]);

  return (
    <Modal onClose={onClose} label={title} className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Globe className="size-4 text-muted-foreground" />
        <p className="flex-1 text-sm font-semibold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <form
        className="flex gap-2 border-b border-border p-4 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. greek yogurt"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={draft.trim().length < 2}>
          Search
        </Button>
      </form>
      {added.length > 0 && (
        <p className="flex items-center gap-1.5 px-4 pt-3 text-xs text-primary">
          <Check className="size-3.5 shrink-0" />
          <span className="truncate">Added {added.join(", ")}</span>
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.length >= 2 ? (
          <OffSearchPanel
            key={query}
            auto
            query={query}
            onPick={(p) => {
              onPick(p);
              setAdded((a) => (a.includes(p.name) ? a : [...a, p.name]));
            }}
          />
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Type a food or brand and tap Search. Picks are saved to your products.
          </p>
        )}
      </div>
    </Modal>
  );
}
