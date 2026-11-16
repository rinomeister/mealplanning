import type { Macros, MealMacros } from "@/lib/macros";
import { SLOTS, type SlotKey } from "@/lib/schemas";

type Targets = { [K in keyof Macros]: number | null };

/** What's left of each target (negative when over); null where no target. */
export function remainingMacros(totals: Macros, targets: Targets): Targets {
  const out = {} as Targets;
  for (const k of Object.keys(totals) as (keyof Macros)[]) {
    const t = targets[k];
    out[k] = t != null && t > 0 ? t - totals[k] : null;
  }
  return out;
}

export type SuggestMeal = MealMacros & { id: string; name: string };

/**
 * Saved meals that still fit today. A meal fits when one serving stays inside
 * the remaining kcal and every remaining ceiling (fat, carbs, sugar) — with a
 * little slack, since nobody weighs to the gram. Ranked by how much of the
 * remaining protein it covers, then by how well it uses the remaining kcal.
 */
export function suggestMeals(
  meals: SuggestMeal[],
  remaining: Targets,
  limit = 3,
): SuggestMeal[] {
  const kcalLeft = remaining.kcal;
  if (kcalLeft == null || kcalLeft < 80) return [];

  const fits = (value: number | null, left: number | null) =>
    left == null || (value ?? 0) <= Math.max(left, 0) * 1.1 + 2;

  const proteinLeft = remaining.protein != null && remaining.protein > 0 ? remaining.protein : null;

  return meals
    .filter(
      (m) =>
        m.kcal != null &&
        m.kcal > 0 &&
        m.kcal <= kcalLeft * 1.05 &&
        fits(m.fat, remaining.fat) &&
        fits(m.carbs, remaining.carbs) &&
        fits(m.sugar, remaining.sugar),
    )
    .map((m) => {
      const kcalUse = (m.kcal ?? 0) / kcalLeft; // 0..~1, higher fills the gap
      const proteinCover = proteinLeft
        ? Math.min(m.protein ?? 0, proteinLeft) / proteinLeft
        : 0;
      return { m, score: proteinCover * 2 + kcalUse };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.m);
}

/** The slot after the latest one that has something in it — "your next meal". */
export function nextOpenSlot(filled: Set<SlotKey>): SlotKey {
  let lastFilled = -1;
  SLOTS.forEach((s, i) => {
    if (filled.has(s)) lastFilled = i;
  });
  return SLOTS[Math.min(lastFilled + 1, SLOTS.length - 1)];
}
