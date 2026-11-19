import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { MealBuilder } from "@/components/meal/meal-builder";
import { loadMealFormProducts } from "@/lib/meal-form-products";
import { loadProductUsage } from "@/lib/load-usage";
import { loadTargets } from "@/lib/load-day";

export default async function NewMealPage() {
  const userId = await requireUserId();
  const [tags, products, productUsage, targets] = await Promise.all([
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    loadMealFormProducts(),
    loadProductUsage(userId),
    loadTargets(userId),
  ]);

  return <MealBuilder tags={tags} products={products} productUsage={productUsage} targets={targets} />;
}
