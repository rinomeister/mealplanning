import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { MealForm, type MealFormInitial } from "@/components/meal-form";
import { loadMealFormProducts } from "@/lib/meal-form-products";

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

  const [meal, tags, products] = await Promise.all([
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
    loadMealFormProducts(),
  ]);

  if (!meal) notFound();

  const initial: MealFormInitial = {
    id: meal.id,
    name: meal.name,
    prepSteps: meal.prepSteps ?? "",
    servingLabel: meal.servingLabel ?? "",
    serves: numToStr(meal.serves) || "1",
    macrosManual: meal.macrosManual,
    kcal: numToStr(meal.kcal),
    protein: numToStr(meal.protein),
    fat: numToStr(meal.fat),
    carbs: numToStr(meal.carbs),
    sugar: numToStr(meal.sugar),
    fiber: numToStr(meal.fiber),
    ingredients: meal.ingredients.map((ing) => ({
      name: ing.name,
      qty: numToStr(ing.qty),
      unit: ing.unit ?? "",
      note: ing.note ?? "",
      barcode: ing.barcode,
      per100g:
        ing.kcal != null ||
        ing.protein != null ||
        ing.fat != null ||
        ing.carbs != null ||
        ing.sugar != null ||
        ing.fiber != null
          ? {
              kcal: ing.kcal,
              protein: ing.protein,
              fat: ing.fat,
              carbs: ing.carbs,
              sugar: ing.sugar,
              fiber: ing.fiber,
            }
          : null,
    })),
    tagIds: meal.tags.map((t) => t.tagId),
  };

  return (
    <>
      <PageHeader title="Edit meal" />
      <MealForm tags={tags} products={products} initial={initial} />
    </>
  );
}
