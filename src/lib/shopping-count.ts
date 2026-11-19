import { prisma } from "@/lib/prisma";
import { keyToDbDate, type DateKey } from "@/lib/dates";
import { aggregateIngredients } from "@/lib/shopping";

/**
 * How many shopping-list items are still to buy for planned entries in a date
 * range — not ticked off and not marked "at home". Same rules as the List tab.
 */
export async function countToBuy(userId: string, start: DateKey, end: DateKey): Promise<number> {
  const entries = await prisma.planEntry.findMany({
    where: {
      userId,
      status: "PLANNED",
      OR: [{ mealId: { not: null } }, { productId: { not: null } }],
      date: { gte: keyToDbDate(start), lte: keyToDbDate(end) },
    },
    select: {
      servings: true,
      grams: true,
      meal: { select: { ingredients: { select: { name: true, qty: true, unit: true } } } },
      product: { select: { name: true } },
    },
  });
  const items = aggregateIngredients(
    entries.flatMap((e) => {
      if (e.meal) return [{ servings: e.servings, meal: e.meal }];
      if (e.product) {
        return [{ servings: 1, meal: { ingredients: [{ name: e.product.name, qty: e.grams, unit: "g" }] } }];
      }
      return [];
    }),
  );
  if (items.length === 0) return 0;
  const checks = await prisma.shoppingCheck.findMany({
    where: { userId, itemKey: { in: items.map((i) => i.key) } },
    select: { itemKey: true, checked: true, atHome: true },
  });
  const done = new Set(checks.filter((c) => c.checked || c.atHome).map((c) => c.itemKey));
  return items.filter((i) => !done.has(i.key)).length;
}
