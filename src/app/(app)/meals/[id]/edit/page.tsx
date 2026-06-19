import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { MealForm, type MealFormInitial } from "@/components/meal-form";

function numToStr(n: number | null): string {
  return n == null ? "" : n.toString();
}

export default async function EditMealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;

  const [meal, tags] = await Promise.all([
    prisma.meal.findFirst({
      where: { id, userId },
      include: {
        ingredients: { orderBy: { position: "asc" } },
        tags: { select: { tagId: true } },
      },
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  if (!meal) notFound();

  const initial: MealFormInitial = {
    id: meal.id,
    name: meal.name,
    prepSteps: meal.prepSteps ?? "",
    servingLabel: meal.servingLabel ?? "",
    kcal: numToStr(meal.kcal),
    protein: numToStr(meal.protein),
    fat: numToStr(meal.fat),
    carbs: numToStr(meal.carbs),
    ingredients: meal.ingredients.map((ing) => ({
      name: ing.name,
      qty: numToStr(ing.qty),
      unit: ing.unit ?? "",
      note: ing.note ?? "",
    })),
    tagIds: meal.tags.map((t) => t.tagId),
  };

  return (
    <>
      <PageHeader title="Edit meal" />
      <MealForm tags={tags} initial={initial} />
    </>
  );
}
