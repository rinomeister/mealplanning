import { prisma } from "@/lib/prisma";
import type { LastAmount, Usage } from "@/lib/usage";

// Server-side loaders for the picker shortcuts. Kept apart from usage.ts so
// client components can import its types and helpers without pulling in Prisma.

/** How many recent items the pickers show. */
const RECENT_LIMIT = 8;
/** Entries scanned to find them — plenty for a couple of weeks of logging. */
const SCAN_LIMIT = 300;

function collect(
  rows: { id: string | null; servings: number; grams: number | null }[],
): Pick<Usage, "recentIds" | "last"> {
  const recentIds: string[] = [];
  const last: Record<string, LastAmount> = {};
  for (const r of rows) {
    if (!r.id || last[r.id]) continue;
    last[r.id] = { servings: r.servings, grams: r.grams };
    if (recentIds.length < RECENT_LIMIT) recentIds.push(r.id);
  }
  return { recentIds, last };
}

export async function loadProductUsage(userId: string): Promise<Usage> {
  const [rows, favorites] = await Promise.all([
    prisma.planEntry.findMany({
      where: { userId, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: SCAN_LIMIT,
      select: { productId: true, servings: true, grams: true },
    }),
    prisma.productFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { productId: true },
    }),
  ]);
  return {
    ...collect(rows.map((r) => ({ id: r.productId, servings: r.servings, grams: r.grams }))),
    favoriteIds: favorites.map((f) => f.productId),
  };
}

/** Meal favorites live on the meal row itself, so only recents are loaded. */
export async function loadMealUsage(
  userId: string,
): Promise<Pick<Usage, "recentIds" | "last">> {
  const rows = await prisma.planEntry.findMany({
    where: { userId, mealId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: SCAN_LIMIT,
    select: { mealId: true, servings: true, grams: true },
  });
  return collect(rows.map((r) => ({ id: r.mealId, servings: r.servings, grams: r.grams })));
}
