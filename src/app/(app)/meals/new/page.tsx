import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { MealForm } from "@/components/meal-form";
import { loadMealFormProducts } from "@/lib/meal-form-products";

export default async function NewMealPage() {
  const userId = await requireUserId();
  const [tags, products] = await Promise.all([
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    loadMealFormProducts(),
  ]);

  return (
    <>
      <PageHeader title="New meal" description="Add a meal to your library." />
      <MealForm tags={tags} products={products} />
    </>
  );
}
