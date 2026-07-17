"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import {
  logExistingProductSchema,
  logProductSchema,
  productMacrosSchema,
  type LogExistingProductInputRaw,
  type LogProductInputRaw,
  type ProductMacrosInputRaw,
  type SlotKey,
} from "@/lib/schemas";
import { keyToDbDate } from "@/lib/dates";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Next free position in a day+slot, so new entries append rather than collide. */
async function nextPosition(userId: string, date: string, slot: SlotKey) {
  const last = await prisma.planEntry.findFirst({
    where: { userId, date: keyToDbDate(date), slot },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

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

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId: product.id,
      grams,
      position: await nextPosition(userId, date, slot),
    },
  });

  revalidatePath("/track");
  revalidatePath(`/calendar/${date}`);
  revalidatePath("/calendar");
  return { ok: true };
}

/**
 * Log a product we already hold, by id. Unlike `logProductAction` this carries
 * no macro payload — the row is the source of truth, so a product corrected on
 * the Products page stays corrected everywhere.
 */
export async function logExistingProductAction(
  input: Omit<LogExistingProductInputRaw, "slot"> & { slot: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = logExistingProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };

  const { date, slot, productId, grams } = parsed.data;

  const exists = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!exists) return { ok: false, error: "That product no longer exists." };

  await prisma.planEntry.create({
    data: {
      userId,
      date: keyToDbDate(date),
      slot,
      productId,
      grams,
      position: await nextPosition(userId, date, slot),
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
