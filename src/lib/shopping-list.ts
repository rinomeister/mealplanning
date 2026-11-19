import { prisma } from "@/lib/prisma";
import { addDaysKey, dbDateToKey, keyToDbDate, type DateKey } from "@/lib/dates";
import { aggregateIngredients, formatShoppingAmount } from "@/lib/shopping";
import { AISLES, AISLE_LABELS, aisleKey, guessAisle } from "@/lib/aisles";
import { SLOT_LABELS, type SlotKey } from "@/lib/schemas";

/** An aisle in the user's store order. "other" is always last and never stored. */
export type AisleDef = { key: string; label: string };
export const OTHER_AISLE: AisleDef = { key: "other", label: "Other" };

export const DEFAULT_AISLES: AisleDef[] = AISLES.filter((a) => a !== "other").map((a) => ({
  key: a,
  label: AISLE_LABELS[a],
}));

/** The stored order, validated; falls back to the defaults. */
export function parseAisleOrder(raw: unknown): AisleDef[] {
  if (!Array.isArray(raw)) return DEFAULT_AISLES;
  const out: AisleDef[] = [];
  const seen = new Set<string>();
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const { key, label } = a as Record<string, unknown>;
    if (typeof key !== "string" || typeof label !== "string" || !key || key === "other" || seen.has(key)) continue;
    seen.add(key);
    out.push({ key: key.slice(0, 40), label: label.slice(0, 40) });
  }
  return out;
}

export async function loadAisles(userId: string): Promise<AisleDef[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { aisleOrder: true } });
  return [...parseAisleOrder(u?.aisleOrder ?? null), OTHER_AISLE];
}

export type ListItem = {
  kind: "plan" | "extra";
  /** ShoppingCheck key for plan items, the row id for extras. */
  key: string;
  name: string;
  amount: string;
  /** "Skyr oat bowl ×4 · Snack 2" */
  from: string;
  checked: boolean;
  aisle: string;
};

export type ShoppingList = {
  aisles: AisleDef[];
  groups: { aisle: AisleDef; items: ListItem[] }[];
  atHome: ListItem[];
  total: number;
  left: number;
};

const fmtCount = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

/**
 * The shopping list for a date range: ingredients of planned meals and planned
 * products (summed, with where they come from), plus the user's own items,
 * grouped by the user's aisles in store order.
 */
export async function loadShoppingList(userId: string, start: DateKey, end: DateKey): Promise<ShoppingList> {
  const [entries, extras, aisles] = await Promise.all([
    prisma.planEntry.findMany({
      where: {
        userId,
        status: "PLANNED",
        OR: [{ mealId: { not: null } }, { productId: { not: null } }],
        date: { gte: keyToDbDate(start), lte: keyToDbDate(end) },
      },
      select: {
        slot: true,
        servings: true,
        grams: true,
        meal: { select: { name: true, ingredients: { select: { name: true, qty: true, unit: true } } } },
        product: { select: { name: true } },
      },
    }),
    prisma.shoppingExtra.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    loadAisles(userId),
  ]);

  const items = aggregateIngredients(
    entries.flatMap((e): Parameters<typeof aggregateIngredients>[0] => {
      if (e.meal) return [{ servings: e.servings, source: e.meal.name, meal: { ingredients: e.meal.ingredients } }];
      if (e.product) {
        return [
          {
            servings: 1,
            source: SLOT_LABELS[e.slot as SlotKey],
            sourceCount: 1,
            meal: { ingredients: [{ name: e.product.name, qty: e.grams, unit: "g" }] },
          },
        ];
      }
      return [];
    }),
  );

  const [checks, overrides] = await Promise.all([
    prisma.shoppingCheck.findMany({
      where: { userId, itemKey: { in: items.map((i) => i.key) } },
      select: { itemKey: true, checked: true, atHome: true },
    }),
    prisma.shoppingAisle.findMany({
      where: { userId, name: { in: [...new Set(items.map((i) => aisleKey(i.name)))] } },
      select: { name: true, aisle: true },
    }),
  ]);
  const checked = new Set(checks.filter((c) => c.checked).map((c) => c.itemKey));
  const home = new Set(checks.filter((c) => c.atHome).map((c) => c.itemKey));
  const override = new Map(overrides.map((o) => [o.name, o.aisle]));
  const keys = new Set(aisles.map((a) => a.key));
  const place = (name: string, chosen?: string | null) => {
    const a = chosen ?? override.get(aisleKey(name)) ?? guessAisle(name);
    return keys.has(a) ? a : "other";
  };

  const planItems: ListItem[] = items.map((i) => ({
    kind: "plan",
    key: i.key,
    name: i.name,
    amount: formatShoppingAmount(i),
    from: i.sources.map((s) => (s.count > 1.001 ? `${s.label} ×${fmtCount(s.count)}` : s.label)).join(" · "),
    checked: checked.has(i.key),
    aisle: place(i.name),
  }));
  const extraItems: ListItem[] = extras.map((x) => ({
    kind: "extra",
    key: x.id,
    name: x.name,
    amount: x.amount ?? "",
    from: "Added by you",
    checked: x.checked,
    aisle: place(x.name, x.aisle),
  }));

  const toBuy = [...planItems.filter((i) => !home.has(i.key)), ...extraItems];
  const groups = aisles
    .map((aisle) => ({ aisle, items: toBuy.filter((i) => i.aisle === aisle.key) }))
    .filter((g) => g.items.length > 0);
  return {
    aisles,
    groups,
    atHome: planItems.filter((i) => home.has(i.key)),
    total: toBuy.length,
    left: toBuy.filter((i) => !i.checked).length,
  };
}

/**
 * The list's default range: today through the last planned day (up to four
 * weeks out), or the coming week when nothing is planned.
 */
export async function defaultListRange(userId: string, today: DateKey): Promise<{ start: DateKey; end: DateKey }> {
  const last = await prisma.planEntry.findFirst({
    where: {
      userId,
      status: "PLANNED",
      date: { gte: keyToDbDate(today), lte: keyToDbDate(addDaysKey(today, 27)) },
    },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return { start: today, end: last ? dbDateToKey(last.date) : addDaysKey(today, 6) };
}

/** Items still to buy over the default range (Home, the List badge). */
export async function countLeftToBuy(userId: string, today: DateKey): Promise<number> {
  const { start, end } = await defaultListRange(userId, today);
  return (await loadShoppingList(userId, start, end)).left;
}
