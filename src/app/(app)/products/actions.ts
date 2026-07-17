"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import {
  editProductSchema,
  manualProductSchema,
  type EditProductInputRaw,
  type ManualProductInputRaw,
} from "@/lib/schemas";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

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

  const product = await prisma.product.create({
    data: { ...parsed.data, barcode: null, source: "user" },
    select: { id: true },
  });

  revalidatePath("/products");
  revalidatePath("/track");
  return { ok: true, id: product.id };
}

/** Correct an existing product in place. Works for scanned rows too. */
export async function updateProductAction(
  input: EditProductInputRaw,
): Promise<ActionResult> {
  await requireUserId();
  const parsed = editProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product details." };

  const { id, ...data } = parsed.data;
  const { count } = await prisma.product.updateMany({
    where: { id },
    data: { ...data, source: "user" },
  });
  if (count === 0) return { ok: false, error: "Product not found." };

  revalidatePath("/products");
  revalidatePath("/track");
  revalidatePath("/calendar");
  return { ok: true };
}

/**
 * Delete a product, but only if nothing has been logged against it — the
 * PlanEntry relation is `onDelete: Restrict`, so removing a used product would
 * otherwise blow up. We check first to explain why instead of throwing.
 */
export async function deleteProductAction(id: string): Promise<ActionResult> {
  await requireUserId();

  const used = await prisma.planEntry.count({ where: { productId: id } });
  if (used > 0) {
    return {
      ok: false,
      error: `Logged ${used} time${used === 1 ? "" : "s"} — deleting it would erase that history.`,
    };
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  return { ok: true };
}
