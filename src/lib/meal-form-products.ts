import { prisma } from "@/lib/prisma";
import type { PickerProduct } from "@/components/add-product-dialog";

/**
 * The products offered in the meal form's "From products" picker. Products are
 * shared across the household (no user filter), matching the tracking page.
 */
export async function loadMealFormProducts(): Promise<PickerProduct[]> {
  const rows = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      brand: true,
      barcode: true,
      servingGrams: true,
      kcal: true,
      protein: true,
      fat: true,
      carbs: true,
      sugar: true,
      fiber: true,
    },
  });

  return rows.map((p) => ({
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
}
