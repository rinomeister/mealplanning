import { prisma } from "@/lib/prisma";
import {
  PICKER_PRODUCT_SELECT,
  toPickerProduct,
  type PickerProduct,
} from "@/lib/products";

/**
 * Every product, in picker shape. Products are shared across the household (no
 * user filter); used by the meal form's "From products" picker and /track.
 */
export async function loadPickerProducts(): Promise<PickerProduct[]> {
  const rows = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: PICKER_PRODUCT_SELECT,
  });
  return rows.map(toPickerProduct);
}

/** Kept under its original name for the meal form pages. */
export const loadMealFormProducts = loadPickerProducts;
