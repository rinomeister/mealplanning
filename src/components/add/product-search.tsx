"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Globe, Loader2, Package, Plus, ScanBarcode, Search, Star, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { scaleGrams, type Macros } from "@/lib/macros";
import { fmtG, fmtKcal, type Targets } from "@/lib/macro-format";
import { flowHref } from "@/lib/add-flow";
import { groupByUsage, type Usage } from "@/lib/usage";
import type { OffSearchHit } from "@/lib/barcode";
import type { PickerProduct } from "@/lib/products";
import { SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/toast";
import { FlowScreen } from "@/components/add/flow-screen";
import { ProductConfirm, type ConfirmProduct } from "@/components/add/product-confirm";
import { NewProductForm } from "@/components/add/new-product-form";
import { importOffProductAction, setProductFavoriteAction } from "@/app/(app)/products/actions";
import { logExistingProductAction, removeEntriesAction } from "@/app/(app)/today/actions";

type Tab = "all" | "favorites" | "recent" | "online";
type Filter = "all" | "protein" | "sugar" | "portions";
type Off = { state: "idle" } | { state: "loading"; q: string } | { state: "done"; q: string; hits: OffSearchHit[] } | { state: "error"; q: string; error: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
  { id: "recent", label: "Recent" },
  { id: "online", label: "Online" },
];
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "protein", label: "High protein" },
  { id: "sugar", label: "Low sugar" },
  { id: "portions", label: "Has portions" },
];

const onlineSub = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

function matches(p: PickerProduct, q: string): boolean {
  const hay = `${p.name} ${p.brand ?? ""}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

/** g protein per 100 kcal. */
export function proteinDensity(per100g: { kcal: number | null; protein: number | null }): number | null {
  if (!per100g.kcal || per100g.protein == null) return null;
  return (per100g.protein / per100g.kcal) * 100;
}

function passes(p: PickerProduct, f: Filter): boolean {
  if (f === "protein") return (proteinDensity(p.per100g) ?? 0) >= 10;
  if (f === "sugar") return p.per100g.sugar != null && p.per100g.sugar <= 5;
  if (f === "portions") return p.portions.length > 0 || p.servingGrams != null;
  return true;
}

const toConfirm = (p: PickerProduct): ConfirmProduct => ({
  id: p.id,
  barcode: p.barcode,
  name: p.name,
  brand: p.brand,
  servingGrams: p.servingGrams,
  portions: p.portions,
  per100g: p.per100g,
});

/**
 * Add a product by name. The search field sits at the bottom (thumb reach,
 * rides the keyboard) with filter chips above it. Your own products filter as
 * you type; Open Food Facts runs on the search key, being rate-limited.
 */
export function ProductSearch({
  date,
  initialSlot,
  eatenFlag,
  backHref,
  products,
  usage,
  eaten,
  targets,
}: {
  date: string;
  initialSlot: SlotKey;
  eatenFlag: boolean;
  backHref: string;
  products: PickerProduct[];
  usage: Usage;
  eaten: Macros;
  targets: Targets;
}) {
  const router = useRouter();
  const toast = useToast();
  const online = useSyncExternalStore(onlineSub, () => navigator.onLine, () => true);
  const [slot, setSlot] = useState<SlotKey>(initialSlot);
  const [tab, setTab] = useState<Tab>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [off, setOff] = useState<Off>({ state: "idle" });
  const [confirm, setConfirm] = useState<ConfirmProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(usage.favoriteIds);
  const [dayEaten, setDayEaten] = useState(eaten);

  const q = query.trim();
  const last = (id: string) => usage.last[id]?.grams ?? null;

  const mine = useMemo(() => {
    const pool = products.filter((p) => passes(p, filter) && (!q || matches(p, q)));
    if (tab === "favorites") return favorites.flatMap((id) => pool.find((p) => p.id === id) ?? []);
    if (tab === "recent") return usage.recentIds.flatMap((id) => pool.find((p) => p.id === id) ?? []);
    if (q) {
      const fav = new Set(favorites);
      return [...pool].sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id))).slice(0, 60);
    }
    const g = groupByUsage(pool, { recentIds: usage.recentIds, favoriteIds: favorites });
    return [...g.favorites, ...g.recent, ...g.rest].slice(0, 60);
  }, [products, filter, q, tab, favorites, usage.recentIds]);

  async function searchOff() {
    if (q.length < 2 || !online) return;
    setOff({ state: "loading", q });
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { ok: true; hits: OffSearchHit[] } | { ok: false; error: string };
      setOff(data.ok ? { state: "done", q, hits: data.hits } : { state: "error", q, error: data.error });
    } catch {
      setOff({ state: "error", q, error: "Search failed. Check your connection." });
    }
  }

  function track(m: Macros) {
    if (!eatenFlag) return;
    setDayEaten((d) => ({
      kcal: d.kcal + m.kcal,
      protein: d.protein + m.protein,
      fat: d.fat + m.fat,
      carbs: d.carbs + m.carbs,
      sugar: d.sugar + m.sugar,
      fiber: d.fiber + m.fiber,
    }));
  }

  /** Log and toast; returns success. */
  async function log(p: ConfirmProduct, grams: number): Promise<boolean> {
    if (!p.id) return false;
    const res = await logExistingProductAction({ date, slot, productId: p.id, grams }, { eaten: eatenFlag });
    if (!res.ok) return false;
    const m = scaleGrams(p.per100g, grams);
    track(m);
    toast.undoable({
      message: `Added to ${SLOT_LABELS[slot]} · ${fmtKcal(m.kcal)} kcal`,
      commit: () => {},
      undo: () => void removeEntriesAction([res.id]),
    });
    return true;
  }

  async function quickAdd(p: PickerProduct) {
    setPending(p.id);
    const ok = await log(toConfirm(p), last(p.id) ?? p.servingGrams ?? 100);
    setPending(null);
    if (!ok) toast.show({ message: "Couldn't add that", tone: "error" });
  }

  async function pickOff(hit: OffSearchHit) {
    setPending(hit.barcode);
    const res = await importOffProductAction({
      barcode: hit.barcode,
      name: hit.name,
      brand: hit.brand,
      servingLabel: hit.servingLabel,
      servingGrams: hit.servingGrams,
      ...hit.per100g,
    });
    setPending(null);
    if (res.ok) setConfirm(toConfirm(res.product));
    else toast.show({ message: res.error, tone: "error" });
  }

  function toggleFavorite(id: string) {
    const on = !favorites.includes(id);
    setFavorites((f) => (on ? [...f, id] : f.filter((x) => x !== id)));
    void setProductFavoriteAction(id, on);
  }

  if (creating) {
    return (
      <NewProductForm
        initialName={q}
        slot={slot}
        onBack={() => setCreating(false)}
        onSaved={(p) => {
          setCreating(false);
          setConfirm(p);
        }}
      />
    );
  }

  const showMine = tab !== "online";
  const showOff = (tab === "all" || tab === "online") && q.length >= 2;

  return (
    <FlowScreen
      top={
        <>
          <div className="flex items-center gap-1">
            <Link href={backHref} className="-ml-2 grid size-11 place-items-center rounded-[14px]" aria-label="Back">
              <ChevronLeft className="size-6" />
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold">
              Add product <span className="font-normal text-ink-3">· {SLOT_LABELS[slot]}</span>
            </h1>
            <Link href={flowHref("scan", slot, date)} className="grid size-11 place-items-center rounded-[14px] bg-surface-2" aria-label="Scan a barcode instead">
              <ScanBarcode className="size-5" />
            </Link>
          </div>
          <div role="tablist" aria-label="Show" className="mt-2 flex gap-5 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  if (t.id === "online" && q.length >= 2 && off.state === "idle") void searchOff();
                }}
                className={cn(
                  "relative h-11 text-[15px] font-semibold",
                  tab === t.id ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-ink" : "text-ink-3",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      }
      bottom={
        <div className="flex flex-col gap-2.5">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                onPointerDown={(e) => e.preventDefault()}
                className={cn("chip sm", filter === f.id && "on")}
                aria-pressed={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              void searchOff();
            }}
          >
            <label className="relative flex-1">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products"
                className="h-[52px] w-full rounded-full border-2 border-transparent bg-surface-2 pl-11 pr-4 text-[17px] outline-none focus:border-ink focus:bg-surface"
              />
            </label>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="press grid size-[52px] shrink-0 place-items-center rounded-full bg-surface-2"
              aria-label="New product"
            >
              <Plus className="size-5" />
            </button>
          </form>
        </div>
      }
    >
      <div className="pb-4">
        {showMine && (
          <section className="mt-3">
            <h2 className="t-cap mb-1">
              {tab === "favorites" ? "Favorites" : tab === "recent" ? "Recent" : "My products"} · {mine.length}
            </h2>
            {mine.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">
                {q ? `None of your products match “${q}”.` : tab === "favorites" ? "Star products to see them here." : "Nothing here yet."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {mine.map((p) => {
                  const l = last(p.id);
                  const fav = favorites.includes(p.id);
                  const sub = [
                    p.per100g.kcal != null ? `${fmtKcal(p.per100g.kcal)} kcal` : "no macros",
                    p.per100g.protein != null ? `${fmtG(p.per100g.protein)} P per 100 g` : null,
                    l != null ? `last ${fmtG(l)} g` : p.portions[0] ? `1 ${p.portions[0].label} = ${fmtG(p.portions[0].grams)} g` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <button type="button" onClick={() => setConfirm(toConfirm(p))} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="grid size-11 shrink-0 place-items-center rounded-thumb bg-surface-2 text-ink-2">
                          {fav ? <Star className="size-5 fill-current" /> : <Package className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{p.name}</span>
                          <span className="block truncate text-[13px] text-ink-3">{sub}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void quickAdd(p)}
                        disabled={pending === p.id}
                        className="press grid size-11 shrink-0 place-items-center rounded-full bg-surface-2"
                        aria-label={`Add ${fmtG(l ?? p.servingGrams ?? 100)} g of ${p.name}`}
                      >
                        {pending === p.id ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {showOff && (
          <section className="mt-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="t-cap">Open Food Facts</h2>
              {off.state === "done" && <span className="text-[13px] text-ink-3">Tap to save &amp; add</span>}
            </div>
            {!online ? (
              <p className="flex items-center gap-2 py-4 text-sm text-ink-3">
                <WifiOff className="size-4" /> Searching Open Food Facts needs a connection.
              </p>
            ) : off.state === "idle" || (off.state !== "loading" && off.q !== q) ? (
              <button type="button" onClick={() => void searchOff()} className="flex min-h-12 w-full items-center gap-3 text-left font-semibold">
                <span className="grid size-11 place-items-center rounded-thumb bg-surface-2">
                  <Globe className="size-5" />
                </span>
                Search Open Food Facts for “{q}”
              </button>
            ) : off.state === "loading" ? (
              <div className="flex flex-col gap-3 py-2" aria-label="Searching">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="size-11 rounded-thumb bg-surface-2" />
                    <span className="flex-1">
                      <span className="block h-3.5 w-2/3 rounded bg-surface-2" />
                      <span className="mt-2 block h-3 w-1/3 rounded bg-surface-2" />
                    </span>
                  </div>
                ))}
              </div>
            ) : off.state === "error" ? (
              <p className="py-4 text-sm text-bad">{off.error}</p>
            ) : off.hits.length === 0 ? (
              <p className="py-4 text-sm text-ink-3">No matches with nutrition data.</p>
            ) : (
              <ul className="divide-y divide-line">
                {off.hits.map((h) => (
                  <li key={h.barcode}>
                    <button type="button" onClick={() => void pickOff(h)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                      <span className="grid size-11 shrink-0 place-items-center rounded-thumb bg-surface-2 text-ink-2">
                        <Globe className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{h.name}</span>
                        <span className="block truncate text-[13px] text-ink-3">
                          {[
                            h.per100g.kcal != null ? `${fmtKcal(h.per100g.kcal)} kcal` : null,
                            h.per100g.protein != null ? `${fmtG(h.per100g.protein)} P per 100 g` : null,
                            h.brand,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {pending === h.barcode ? <Loader2 className="size-5 animate-spin" /> : <ChevronRight className="size-5 text-ink-3" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {confirm && (
        <Sheet label={`Add ${confirm.name}`} onClose={() => setConfirm(null)}>
          <ProductConfirm
            product={confirm}
            lastGrams={confirm.id ? last(confirm.id) : null}
            slot={slot}
            onSlot={setSlot}
            eaten={dayEaten}
            targets={targets}
            favorite={confirm.id ? favorites.includes(confirm.id) : undefined}
            onToggleFavorite={confirm.id ? () => toggleFavorite(confirm.id!) : undefined}
            onAdd={async (g) => {
              const ok = await log(confirm, g);
              if (ok) router.push(backHref);
              return ok;
            }}
          />
        </Sheet>
      )}
    </FlowScreen>
  );
}
