"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtG, fmtKcal } from "@/lib/macro-format";
import { tagStyle } from "@/lib/tag-colors";
import { MacroDot } from "@/components/macro-ui";
import { EmptyState } from "@/components/empty-state";

type TagItem = { id: string; name: string; color: string | null };
type LibMeal = {
  id: string;
  name: string;
  favorite: boolean;
  servingLabel: string | null;
  serves: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  tagIds: string[];
};

/** Library · Meals: cards with per-serving kcal + P/C/F, filtered by tag. */
export function MealLibrary({
  meals,
  tags,
  initialTag,
}: {
  meals: LibMeal[];
  tags: TagItem[];
  initialTag: string | null;
}) {
  const [q, setQ] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [tag, setTag] = useState<string | null>(initialTag);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const list = meals.filter(
    (m) =>
      (!q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase())) &&
      (!onlyFavs || m.favorite) &&
      (!tag || m.tagIds.includes(tag)),
  );

  return (
    <>
      {meals.length > 6 && (
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your meals"
            aria-label="Search your meals"
            className="h-[52px] w-full rounded-full bg-surface-2 pl-12 pr-4 text-[17px] outline-none focus:ring-2 focus:ring-ink"
          />
        </label>
      )}

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <button type="button" className={cn("chip sm shrink-0", onlyFavs && "on")} aria-pressed={onlyFavs} onClick={() => setOnlyFavs((v) => !v)}>
          Favorites
        </button>
        {tags.map((t) => {
          const on = tag === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => setTag(on ? null : t.id)}
              className={cn("chip sm shrink-0", on && "border-ink")}
              style={on ? tagStyle(t.color) : undefined}
            >
              {t.name}
            </button>
          );
        })}
        <Link href="/import" className="chip sm shrink-0">
          <Download className="size-4" /> Import
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={meals.length === 0 ? "No meals yet" : "Nothing matches"}
          description={meals.length === 0 ? "Build one from your products, or import a meal someone shared." : "Try another tag or clear the filters."}
        />
      ) : (
        <ul className="flex flex-col gap-2.5 pb-24 tab:grid tab:grid-cols-2">
          {list.map((m) => {
            const per = m.servingLabel?.trim().replace(/^1\s+/, "") || "serving";
            return (
              <li key={m.id}>
                <Link href={`/meals/${m.id}`} className="card press flex h-full flex-col gap-2 p-4">
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 font-semibold leading-snug">{m.name}</span>
                    {m.favorite && <Star className="size-5 shrink-0 fill-ink" aria-label="Favorite" />}
                  </span>
                  {m.kcal != null && (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="num text-lg font-semibold leading-none">{fmtKcal(m.kcal)}</span>
                      <span className="-ml-1.5 text-[13px] text-ink-3">per {per}</span>
                      {(["protein", "carbs", "fat"] as const).map((k) => (
                        <span key={k} className="inline-flex items-center gap-1 font-semibold text-ink-2">
                          <MacroDot macro={k} />
                          <span className="num">{fmtG(m[k] ?? 0)}</span>
                        </span>
                      ))}
                    </span>
                  )}
                  {m.tagIds.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                      {m.tagIds.map((id) => {
                        const t = tagById.get(id);
                        return t ? (
                          <span key={id} className="tag" style={tagStyle(t.color)}>
                            {t.name}
                          </span>
                        ) : null;
                      })}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pointer-events-none sticky bottom-3 z-10 flex justify-end">
        <Link href="/meals/new" className="press pointer-events-auto flex h-[52px] items-center gap-2 rounded-full bg-ink px-5 font-semibold text-inv shadow-lg">
          <Plus className="size-5" /> New meal
        </Link>
      </div>
    </>
  );
}
