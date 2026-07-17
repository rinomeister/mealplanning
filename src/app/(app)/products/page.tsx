import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { FoodTabs } from "@/components/food-tabs";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NewProductButton,
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
  });

  const products: ManagedProduct[] = records.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    barcode: p.barcode,
    servingGrams: p.servingGrams,
    per100g: {
      kcal: p.kcal,
      protein: p.protein,
      fat: p.fat,
      carbs: p.carbs,
      sugar: p.sugar,
      fiber: p.fiber,
    },
  }));

  return (
    <>
      <PageHeader
        title="Food"
        description="Single foods you scan or type in, with macros per 100 g."
        action={<NewProductButton className="hidden sm:inline-flex" />}
      />
      <FoodTabs active="products" />

      <form action="/products" className="mb-3 flex gap-2">
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

      <div className="mb-4 block sm:hidden">
        <NewProductButton className="w-full" />
      </div>

      {products.length === 0 ? (
        <EmptyState
          title={term ? "No products match" : "No products yet"}
          description={
            term
              ? `Nothing found for “${term}”.`
              : "Scan a barcode or add a product by hand — anything you log on Today shows up here."
          }
          action={<NewProductButton />}
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
