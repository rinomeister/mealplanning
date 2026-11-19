import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { FoodTabs } from "@/components/food-tabs";
import { PICKER_PRODUCT_SELECT, toPickerProduct } from "@/lib/products";
import { ProductLibrary } from "@/components/product/product-library";

export default async function ProductsPage() {
  const userId = await requireUserId();

  // Products are shared, not user-scoped: a barcode means the same thing to
  // everyone, and hand-entered foods are worth sharing between the two of us.
  const [records, favorites, recent, mealCount] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: PICKER_PRODUCT_SELECT }),
    prisma.productFavorite.findMany({ where: { userId }, select: { productId: true } }),
    prisma.planEntry.findMany({
      where: { userId, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { productId: true },
    }),
    prisma.meal.count({ where: { userId } }),
  ]);

  // Most recently used first, each once.
  const recentIds = [...new Set(recent.map((r) => r.productId!))];

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="t-title">Library</h1>
        <span className="text-sm text-ink-3">
          {records.length} product{records.length === 1 ? "" : "s"} · {mealCount} meal{mealCount === 1 ? "" : "s"}
        </span>
      </header>
      <FoodTabs active="products" />
      <ProductLibrary
        products={records.map(toPickerProduct)}
        favoriteIds={favorites.map((f) => f.productId)}
        recentIds={recentIds}
      />
    </>
  );
}
