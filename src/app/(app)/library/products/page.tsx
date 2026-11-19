import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { FoodTabs } from "@/components/food-tabs";
import { PICKER_PRODUCT_SELECT, toPickerProduct } from "@/lib/products";
import { ProductLibrary } from "@/components/product/product-library";
import { ProductPane } from "@/components/product/product-edit";
import { MousePointerClick } from "lucide-react";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const userId = await requireUserId();
  const { p: selectedId } = await searchParams;

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

  // Desktop: the product picked in the list opens in the pane beside it.
  const selectedRow = selectedId
    ? await prisma.product.findUnique({ where: { id: selectedId }, select: { ...PICKER_PRODUCT_SELECT, servingLabel: true } })
    : null;

  // Most recently used first, each once.
  const recentIds = [...new Set(recent.map((r) => r.productId!))];

  return (
    <div className="desk:grid desk:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desk:gap-8">
    <div className="min-w-0">
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
        selectedId={selectedRow?.id}
      />
    </div>
    <aside className="hidden desk:sticky desk:top-0 desk:block desk:h-[calc(100dvh-4.5rem)]" aria-label="Product">
      {selectedRow ? (
        <ProductPane key={selectedRow.id} initial={{ ...toPickerProduct(selectedRow), servingLabel: selectedRow.servingLabel }} />
      ) : (
        <div className="grid h-full place-items-center rounded-card border border-dashed border-line text-center text-ink-3">
          <div className="flex flex-col items-center gap-2">
            <MousePointerClick className="size-6" />
            <p>Pick a product to edit it here.</p>
          </div>
        </div>
      )}
    </aside>
    </div>
  );
}
