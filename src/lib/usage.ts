/** How much of something was logged last time. */
export type LastAmount = { servings: number; grams: number | null };

/**
 * What a user reaches for: the products or meals they logged most recently
 * (newest first, each once), the amount they used last time, and their stars.
 * Plain arrays and records so it can be passed straight to client components.
 */
export type Usage = {
  recentIds: string[];
  last: Record<string, LastAmount>;
  favoriteIds: string[];
};

export const EMPTY_USAGE: Usage = { recentIds: [], last: {}, favoriteIds: [] };

/**
 * Order a list for a picker with no search typed: favorites, then recents,
 * then everything else. Returns the three groups so each can get a heading.
 */
export function groupByUsage<T extends { id: string }>(
  items: T[],
  usage: Pick<Usage, "recentIds" | "favoriteIds">,
): { favorites: T[]; recent: T[]; rest: T[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const fav = new Set(usage.favoriteIds);
  const favorites = usage.favoriteIds.flatMap((id) => byId.get(id) ?? []);
  const recent = usage.recentIds
    .filter((id) => !fav.has(id))
    .flatMap((id) => byId.get(id) ?? []);
  const shown = new Set([...favorites, ...recent].map((i) => i.id));
  return { favorites, recent, rest: items.filter((i) => !shown.has(i.id)) };
}
