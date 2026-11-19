import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { FoodTabs } from "@/components/food-tabs";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PICKER_PRODUCT_SELECT, toPickerProduct } from "@/lib/products";
import {
  ProductAddActions,
  ProductCard,
  type ManagedProduct,
} from "@/components/product-manager";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUserId();
  const { q } = await searchParams;
  const term = q?.trim();

  // Products are shared, not user-scoped: a barcode means the same thing to
  // everyone, and hand-entered foods are worth sharing between the two of us.
  const records = await prisma.product.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { brand: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    select: PICKER_PRODUCT_SELECT,
  });

  const products: ManagedProduct[] = records.map(toPickerProduct);

  return (
    <>
      <PageHeader
        title="Library"
        description="Single foods you scan or type in, with macros per 100 g."
      />
      <FoodTabs active="products" />
      <ProductAddActions className="mb-3" />

      <form action="/library/products" className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {products.length === 0 ? (
        <EmptyState
          title={term ? "No products match" : "No products yet"}
          description={
            term
              ? `Nothing found for “${term}”.`
              : "Scan a barcode, search Open Food Facts, or add a product by hand — anything you log on Today shows up here too."
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
