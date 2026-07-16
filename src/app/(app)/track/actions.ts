"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import {
  logProductSchema,
  productMacrosSchema,
  type LogProductInputRaw,
  type ProductMacrosInputRaw,
} from "@/lib/schemas";
import { keyToDbDate } from "@/lib/dates";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Save (or correct) a scanned product's macros in our shared database, keyed by
 * barcode. Flips `source` to "user" so a later re-scan returns these values
 * instead of the Open Food Facts data. Macros are stored per 100 g/ml.
 */
export async function upsertProductMacrosAction(
  input: ProductMacrosInputRaw,
): Promise<ActionResult> {
  await requireUserId();
  const parsed = productMacrosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product details." };

  const { barcode, ...rest } = parsed.data;
  const data = { ...rest, source: "user" };
  await prisma.product.upsert({
    where: { barcode },
    create: { barcode, ...data },
    update: data,
  });

  revalidatePath("/track");
  revalidatePath("/scan");
  return { ok: true };
}

/**
 * Log an eaten quantity (grams) of a scanned product into a day+slot. Caches the
 * product on first log without clobbering an existing user-edited row.
 */
export async function logProductAction(
  input: Omit<LogProductInputRaw, "slot"> & { slot: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = logProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };

  const { date, slot, grams, barcode, ...productFields } = parsed.data;

  // Cache OFF data on first sighting; never overwrite hand-edited macros.
  const product = await prisma.product.upsert({
    where: { barcode },
    create: { barcode, ...productFields, source: "openfoodfacts" },
    update: {},
    select: { id: true },
  });

  const last = await prisma.planEntry.findFirst({
    where: { userId, date: keyToDbDate(date), slot },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId: product.id,
      grams,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/track");
  revalidatePath(`/calendar/${date}`);
  revalidatePath("/calendar");
  return { ok: true };
}

/** Update the eaten weight (grams) of a logged product entry. */
export async function setGramsAction(
  id: string,
  grams: number,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!Number.isFinite(grams) || grams <= 0) {
    return { ok: false, error: "Grams must be positive." };
  }
  const { count } = await prisma.planEntry.updateMany({
    where: { id, userId },
    data: { grams },
  });
  if (count === 0) return { ok: false, error: "Entry not found." };
  revalidatePath("/track");
  revalidatePath("/calendar");
  return { ok: true };
}
