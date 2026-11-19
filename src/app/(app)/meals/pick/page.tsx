import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { dayHref, parseDate, parseSlot } from "@/lib/add-flow";
import { loadMealUsage } from "@/lib/load-usage";
import { loadDayContext } from "@/lib/load-day";
import { gramsPerServing, pickMacros } from "@/lib/macros";
import { remainingMacros } from "@/lib/suggest";
import { MealPick } from "@/components/add/meal-pick";

export default async function MealPickPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; date?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const now = await userNow();
  const date = parseDate(sp.date) ?? now.today;
  const slot = parseSlot(sp.slot) ?? now.slot;

  const [meals, tags, usage, day] = await Promise.all([
    prisma.meal.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kcal: true,
        protein: true,
        fat: true,
        carbs: true,
        sugar: true,
        fiber: true,
        servingLabel: true,
        cookedGrams: true,
        serves: true,
        favorite: true,
        tags: { select: { tagId: true } },
      },
    }),
    prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    loadMealUsage(userId),
    loadDayContext(userId, date),
  ]);

  // What's left counts planned food too: a planned dinner already spends its share.
  const { eaten, planned } = day.totals;
  const committed = {
    kcal: eaten.kcal + planned.kcal,
    protein: eaten.protein + planned.protein,
    fat: eaten.fat + planned.fat,
    carbs: eaten.carbs + planned.carbs,
    sugar: eaten.sugar + planned.sugar,
    fiber: eaten.fiber + planned.fiber,
  };

  return (
    <MealPick
      date={date}
      initialSlot={slot}
      eatenFlag={date <= now.today}
      backHref={dayHref(date, now.today)}
      meals={meals.map((m) => ({
        id: m.id,
        name: m.name,
        per: pickMacros(m),
        servingLabel: m.servingLabel,
        gramsPerServing: gramsPerServing(m),
        cookedGrams: m.cookedGrams,
        favorite: m.favorite,
        tagIds: m.tags.map((t) => t.tagId),
      }))}
      tags={tags}
      last={usage.last}
      remaining={remainingMacros(committed, day.targets)}
    />
  );
}
