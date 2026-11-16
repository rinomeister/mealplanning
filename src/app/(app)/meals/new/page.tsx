import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { MealForm } from "@/components/meal-form";
import { loadMealFormProducts } from "@/lib/meal-form-products";
import { loadProductUsage } from "@/lib/load-usage";

export default async function NewMealPage() {
  const userId = await requireUserId();
  const [tags, products, productUsage] = await Promise.all([
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    loadMealFormProducts(),
    loadProductUsage(userId),
  ]);

  return (
    <>
      <PageHeader title="New meal" description="Add a meal to your library." />
      <MealForm
        tags={tags}
        products={products}
        productUsage={productUsage}
      />
    </>
  );
}
