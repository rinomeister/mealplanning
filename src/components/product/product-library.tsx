"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, ScanBarcode, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtG, fmtKcal } from "@/lib/macro-format";
import type { PickerProduct } from "@/lib/products";
import { proteinDensity } from "@/components/add/product-search";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/empty-state";
import { setProductFavoriteAction } from "@/app/(app)/products/actions";

type Sort = "name" | "density" | "kcal";
const SORT_LABEL: Record<Sort, string> = {
  name: "A–Z",
  density: "protein / 100 kcal",
  kcal: "calories",
};
const SORT_NEXT: Record<Sort, Sort> = { name: "density", density: "kcal", kcal: "name" };

/** "Store brand · 63 kcal · 11 P / 100 g · 1 pot = 150 g". */
function rowLine(p: PickerProduct): string {
  const parts: string[] = [];
  if (p.brand) parts.push(p.brand);
  if (p.per100g.kcal != null) {
    parts.push(`${fmtKcal(p.per100g.kcal)} kcal · ${fmtG(p.per100g.protein ?? 0)} P / 100 g`);
  } else parts.push("no macros");
  const portions = (p.servingGrams ? 1 : 0) + p.portions.length;
  if (portions === 1) {
    const only = p.portions[0] ?? { label: "serving", grams: p.servingGrams! };
    parts.push(`1 ${only.label} = ${fmtG(only.grams)} g`);
  } else if (portions > 1) parts.push(`${portions} portions`);
  return parts.join(" · ");
}

/** On desktop a product opens in the pane beside the list, not its own page. */
const isDesk = () => window.matchMedia("(min-width: 900px)").matches;

/** Library · Products: search, favorites, recently used, sort by protein density. */
export function ProductLibrary({
  products,
  favoriteIds,
  recentIds,
  selectedId,
}: {
  products: PickerProduct[];
  favoriteIds: string[];
  recentIds: string[];
  /** The product open in the desktop pane. */
  selectedId?: string;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to the search field, unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState(() => new Set(favoriteIds));
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [recentFirst, setRecentFirst] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const [choosing, setChoosing] = useState(false);

  const recentRank = useMemo(() => new Map(recentIds.map((id, i) => [id, i])), [recentIds]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows = products.filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term)) &&
        (!onlyFavs || favs.has(p.id)) &&
        (!recentFirst || recentRank.has(p.id)),
    );
    rows = [...rows].sort((a, b) => {
      if (recentFirst) return recentRank.get(a.id)! - recentRank.get(b.id)!;
      if (sort === "density") return (proteinDensity(b.per100g) ?? -1) - (proteinDensity(a.per100g) ?? -1);
      if (sort === "kcal") return (a.per100g.kcal ?? 1e9) - (b.per100g.kcal ?? 1e9);
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [products, q, onlyFavs, favs, recentFirst, recentRank, sort]);

  function toggleFav(id: string) {
    const on = !favs.has(id);
    setFavs((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    void setProductFavoriteAction(id, on);
  }

  return (
    <>
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
        <input
          ref={searchRef}
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your products"
          aria-label="Search your products"
          className="h-[52px] w-full rounded-full bg-surface-2 pl-12 pr-4 text-[17px] outline-none focus:ring-2 focus:ring-ink desk:pr-12"
        />
        <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 font-sans text-sm text-ink-3 desk:block">/</kbd>
      </label>

      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <button type="button" className={cn("chip sm shrink-0", onlyFavs && "on")} aria-pressed={onlyFavs} onClick={() => setOnlyFavs((v) => !v)}>
          Favorites
        </button>
        <button type="button" className={cn("chip sm shrink-0", recentFirst && "on")} aria-pressed={recentFirst} onClick={() => setRecentFirst((v) => !v)}>
          Recently used
        </button>
        <button
          type="button"
          className={cn("chip sm shrink-0", sort !== "name" && !recentFirst && "on")}
          onClick={() => {
            setRecentFirst(false);
            setSort((s) => SORT_NEXT[s]);
          }}
          aria-label={`Sort: ${SORT_LABEL[sort]}. Tap to change`}
        >
          Sort: {SORT_LABEL[sort]} <ChevronDown className="size-4" />
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={products.length === 0 ? "No products yet" : "Nothing matches"}
          description={
            products.length === 0
              ? "Scan a barcode, search Open Food Facts, or type one in. Anything you log shows up here too."
              : "Try another name, or clear the filters."
          }
        />
      ) : (
        <ul className="divide-y divide-line pb-24">
          {list.map((p) => {
            const d = proteinDensity(p.per100g);
            return (
              <li key={p.id} className={cn("flex items-center gap-2", p.id === selectedId && "desk:-mx-3 desk:rounded-[14px] desk:bg-surface desk:px-3 desk:shadow-card")}>
                <Link
                  href={`/products/${p.id}`}
                  aria-current={p.id === selectedId ? "true" : undefined}
                  onClick={(e) => {
                    if (!isDesk()) return;
                    e.preventDefault();
                    router.replace(`/library/products?p=${p.id}`, { scroll: false });
                  }}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block text-[13px] leading-snug text-ink-3">{rowLine(p)}</span>
                  </span>
                  {d != null && (
                    <span
                      className={cn("tag num shrink-0", d >= 10 ? "bg-pro-t text-ink" : "bg-surface-2 text-ink-2")}
                      title="Protein per 100 kcal"
                    >
                      {sort === "density" ? `${fmtG(d)} P/100kcal` : fmtG(d)}
                    </span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => toggleFav(p.id)}
                  aria-pressed={favs.has(p.id)}
                  aria-label={favs.has(p.id) ? `Unstar ${p.name}` : `Star ${p.name}`}
                  className="grid size-11 shrink-0 place-items-center"
                >
                  <Star className={cn("size-5", favs.has(p.id) ? "fill-ink text-ink" : "text-ink-3")} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pointer-events-none sticky bottom-3 z-10 flex justify-end">
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="press pointer-events-auto flex h-[52px] items-center gap-2 rounded-full bg-ink px-5 font-semibold text-inv shadow-lg"
        >
          <Plus className="size-5" /> New product
        </button>
      </div>

      {choosing && (
        <Sheet label="New product" onClose={() => setChoosing(false)} history={false}>
          <div className="flex flex-col gap-2.5 px-4 pb-4">
            <h2 className="t-h2 mb-1">New product</h2>
            {(
              [
                ["/products/new?via=scan", ScanBarcode, "Scan barcode", "Looks it up in Open Food Facts", true],
                ["/products/new?via=online", Search, "Search Open Food Facts", "By name, then review and save", false],
                ["/products/new", Pencil, "Enter it myself", "Home-made, market or restaurant food", false],
              ] as const
            ).map(([href, Icon, title, hint, primary]) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "press flex min-h-16 items-center gap-4 rounded-card px-4 text-left",
                  primary ? "bg-ink text-inv" : "bg-surface-2",
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold">{title}</span>
                  <span className={cn("block text-[13px]", primary ? "opacity-75" : "text-ink-3")}>{hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

