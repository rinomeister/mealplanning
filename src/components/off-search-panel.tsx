"use client";

import { useEffect, useState, useTransition } from "react";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importOffProductAction } from "@/app/(app)/products/actions";
import type { OffSearchHit } from "@/lib/barcode";
import type { PickerProduct } from "@/lib/products";

type SearchState =
  | { phase: "idle" }
  | { phase: "loading"; query: string }
  | { phase: "done"; query: string; hits: OffSearchHit[] }
  | { phase: "error"; query: string; error: string };

/**
 * "Not in your products? Search Open Food Facts." Runs only on an explicit tap
 * (their search is rate-limited, so no search-as-you-type). Picking a hit saves
 * it to our products by barcode and hands it back in picker shape.
 */
export function OffSearchPanel({
  query,
  onPick,
  auto = false,
}: {
  query: string;
  onPick: (product: PickerProduct) => void;
  /** Search as soon as `query` changes (caller only updates it on submit). */
  auto?: boolean;
}) {
  const [state, setState] = useState<SearchState>(() =>
    auto && query.trim().length >= 2
      ? { phase: "loading", query: query.trim() }
      : { phase: "idle" },
  );
  const [pickingCode, setPickingCode] = useState<string | null>(null);
  const [pickError, setPickError] = useState("");
  const [isPending, startTransition] = useTransition();

  const q = query.trim();
  const stale = state.phase !== "idle" && state.query !== q;

  async function search() {
    if (q.length < 2) return;
    setState({ phase: "loading", query: q });
    setPickError("");
    setState(await fetchOff(q));
  }

  // Auto mode searches once on mount; callers remount (key) per new query.
  useEffect(() => {
    if (!auto || q.length < 2) return;
    let cancelled = false;
    void fetchOff(q).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [auto, q]);

  function pick(hit: OffSearchHit) {
    setPickingCode(hit.barcode);
    setPickError("");
    startTransition(async () => {
      const res = await importOffProductAction({
        barcode: hit.barcode,
        name: hit.name,
        brand: hit.brand,
        servingLabel: hit.servingLabel,
        servingGrams: hit.servingGrams,
        ...hit.per100g,
      });
      setPickingCode(null);
      if (res.ok) onPick(res.product);
      else setPickError(res.error);
    });
  }

  if (q.length < 2) return null;

  if (state.phase === "idle" || stale) {
    return (
      <div className="border-t border-border p-3">
        <Button type="button" variant="ghost" className="w-full" onClick={search}>
          <Globe /> Search Open Food Facts for “{q}”
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <p className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-xs font-medium text-muted-foreground">
        <Globe className="size-3.5" /> Open Food Facts
      </p>
      {state.phase === "loading" && (
        <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </p>
      )}
      {state.phase === "error" && (
        <div className="flex flex-col items-center gap-2 px-4 py-4">
          <p className="text-sm text-destructive">{state.error}</p>
          <Button type="button" variant="outline" size="sm" onClick={search}>
            Try again
          </Button>
        </div>
      )}
      {state.phase === "done" &&
        (state.hits.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No matches with nutrition data.
          </p>
        ) : (
          <div className="flex flex-col">
            {state.hits.map((h) => (
              <button
                key={h.barcode}
                type="button"
                disabled={isPending}
                onClick={() => pick(h)}
                className="flex min-h-14 items-center gap-3 border-t border-border px-4 text-left active:bg-muted disabled:opacity-60"
              >
                <div className="min-w-0 flex-1 py-2">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  {h.brand && (
                    <p className="truncate text-xs text-muted-foreground">{h.brand}</p>
                  )}
                </div>
                {pickingCode === h.barcode ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  h.per100g.kcal != null && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {Math.round(h.per100g.kcal)} kcal/100g
                    </span>
                  )
                )}
              </button>
            ))}
          </div>
        ))}
      {pickError && <p className="px-4 pb-3 text-sm text-destructive">{pickError}</p>}
    </div>
  );
}

async function fetchOff(q: string): Promise<SearchState> {
  try {
    const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as
      | { ok: true; hits: OffSearchHit[] }
      | { ok: false; error: string };
    return data.ok
      ? { phase: "done", query: q, hits: data.hits }
      : { phase: "error", query: q, error: data.error };
  } catch {
    return { phase: "error", query: q, error: "Search failed. Check your connection." };
  }
}
