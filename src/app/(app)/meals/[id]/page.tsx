import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { MealDetail } from "@/components/meal/meal-detail";

export default async function MealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imported?: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const { imported } = await searchParams;
  const now = await userNow();

  const [meal, last] = await Promise.all([
    prisma.meal.findFirst({
      where: { id, userId },
      include: {
        ingredients: { orderBy: { position: "asc" } },
        tags: { include: { tag: true } },
        share: { select: { code: true, imports: true } },
      },
    }),
    prisma.planEntry.findFirst({
      where: { userId, mealId: id },
      orderBy: { createdAt: "desc" },
      select: { servings: true, grams: true },
    }),
  ]);
  if (!meal) notFound();

  return (
    <MealDetail
      today={now.today}
      slot={now.slot}
      imported={!!imported}
      last={last}
      meal={{
        id: meal.id,
        name: meal.name,
        favorite: meal.favorite,
        servingLabel: meal.servingLabel,
        serves: meal.serves,
        cookedGrams: meal.cookedGrams,
        prepSteps: meal.prepSteps,
        macros: {
          kcal: meal.kcal ?? 0,
          protein: meal.protein ?? 0,
          fat: meal.fat ?? 0,
          carbs: meal.carbs ?? 0,
          sugar: meal.sugar ?? 0,
          fiber: meal.fiber ?? 0,
        },
        hasMacros: [meal.kcal, meal.protein, meal.fat, meal.carbs, meal.sugar, meal.fiber].some((v) => v != null),
        ingredients: meal.ingredients.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, note: i.note })),
        tags: meal.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
        shareCode: meal.share?.code ?? null,
        imports: meal.share?.imports ?? 0,
      }}
    />
  );
}
