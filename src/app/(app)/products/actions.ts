"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import {
  editProductSchema,
  manualProductSchema,
  productMacrosSchema,
  type EditProductInputRaw,
  type ManualProductInputRaw,
  type ProductMacrosInputRaw,
} from "@/lib/schemas";
import {
  countUpcomingEntries,
  deleteProductKeepingHistory,
  refreshUpcomingEntries,
} from "@/lib/entries";
import { toPickerProduct, PICKER_PRODUCT_SELECT } from "@/lib/products";
import type { PickerProduct } from "@/lib/products";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function portionRows(portions: { label: string; grams: number }[]) {
  return portions.map((p, i) => ({ label: p.label, grams: p.grams, position: i }));
}

function revalidateProducts() {
  revalidatePath("/products");
  revalidatePath("/track");
  revalidatePath("/meals", "layout");
}

/**
 * Create a hand-entered product — food that never had a scannable package.
 * `barcode` stays null and `source` is "user", so a later scan of some unrelated
 * barcode can never overwrite these macros.
 */
export async function createProductAction(
  input: ManualProductInputRaw,
): Promise<CreateResult> {
  await requireUserId();
  const parsed = manualProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product details." };

  const { portions, ...data } = parsed.data;
  const product = await prisma.product.create({
    data: {
      ...data,
      barcode: null,
      source: "user",
      portions: { create: portionRows(portions) },
    },
    select: { id: true },
  });

  revalidateProducts();
  return { ok: true, id: product.id };
}

/**
 * Correct an existing product in place. Works for scanned rows too. The new
 * macros flow into today's and future entries; past days keep what they logged.
 */
export async function updateProductAction(
  input: EditProductInputRaw,
): Promise<ActionResult> {
  await requireUserId();
  const parsed = editProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product details." };

  const { id, portions, ...data } = parsed.data;
  const exists = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { ok: false, error: "Product not found." };

  await prisma.$transaction([
    prisma.productPortion.deleteMany({ where: { productId: id } }),
    prisma.product.update({
      where: { id },
      data: {
        ...data,
        source: "user",
        portions: { create: portionRows(portions) },
      },
    }),
  ]);
  await refreshUpcomingEntries({ productId: id }, data);

  revalidateProducts();
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Delete a product, but only if nothing has been logged against it — the
 * PlanEntry relation is `onDelete: Restrict`, so removing a used product would
 * otherwise blow up. We check first to explain why instead of throwing.
 */
/**
 * For the delete confirmation: upcoming, uneaten plans that would be removed.
 * Products are shared, so this counts both accounts' plans.
 */
export async function productUpcomingCountAction(id: string): Promise<number> {
  await requireUserId();
  return countUpcomingEntries({ productId: id });
}

/**
 * Delete a product. Logged history stays (as "Name · 150 g" entries with the
 * totals they had); upcoming plans for it are removed.
 */
export async function deleteProductAction(id: string): Promise<ActionResult> {
  await requireUserId();
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  await deleteProductKeepingHistory(product);
  revalidatePath("/products");
  revalidatePath("/track");
  revalidatePath("/calendar", "layout");
  revalidatePath("/shopping");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Save a product picked from an Open Food Facts text search, keyed by barcode,
 * and hand it back in picker shape. An existing row (possibly hand-corrected)
 * wins over the search payload, same as scanning.
 */
export async function importOffProductAction(
  input: ProductMacrosInputRaw,
): Promise<{ ok: true; product: PickerProduct } | { ok: false; error: string }> {
  await requireUserId();
  const parsed = productMacrosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product details." };

  const { barcode, ...fields } = parsed.data;
  const row = await prisma.product.upsert({
    where: { barcode },
    create: { barcode, ...fields, source: "openfoodfacts" },
    update: {},
    select: PICKER_PRODUCT_SELECT,
  });

  revalidatePath("/products");
  return { ok: true, product: toPickerProduct(row) };
}

/** Star or unstar a product for the signed-in user only. */
export async function setProductFavoriteAction(
  productId: string,
  favorite: boolean,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!productId) return { ok: false, error: "Invalid product." };
  if (favorite) {
    const exists = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "That product no longer exists." };
    await prisma.productFavorite.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
  } else {
    await prisma.productFavorite.deleteMany({ where: { userId, productId } });
  }
  revalidatePath("/track");
  revalidatePath("/products");
  return { ok: true };
}
