import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { FoodTabs } from "@/components/food-tabs";
import { MealLibrary } from "@/components/meal/meal-library";

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const userId = await requireUserId();
  const { tag } = await searchParams;

  const [tags, meals, productCount] = await Promise.all([
    prisma.tag.findMany({
      where: { userId, meals: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.meal.findMany({
      where: { userId },
      orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        favorite: true,
        servingLabel: true,
        serves: true,
        kcal: true,
        protein: true,
        carbs: true,
        fat: true,
        tags: { select: { tagId: true } },
      },
    }),
    prisma.product.count(),
  ]);

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="t-title">Library</h1>
        <span className="text-sm text-ink-3">
          {productCount} product{productCount === 1 ? "" : "s"} · {meals.length} meal{meals.length === 1 ? "" : "s"}
        </span>
      </header>
      <FoodTabs active="meals" />
      <MealLibrary
        initialTag={tag ?? null}
        tags={tags}
        meals={meals.map((m) => ({ ...m, tagIds: m.tags.map((t) => t.tagId) }))}
      />
    </>
  );
}
