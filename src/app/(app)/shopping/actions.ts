"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { aisleKey, guessAisle, isAisle } from "@/lib/aisles";

/**
 * Tick an item as bought (or untick it). Doesn't revalidate — the row updates
 * itself optimistically and nothing else on the page depends on it.
 */
export async function toggleShoppingCheckAction(
  itemKey: string,
  checked: boolean,
): Promise<void> {
  const userId = await requireUserId();
  if (!itemKey || itemKey.length > 300) return;

  if (checked) {
    await prisma.shoppingCheck.upsert({
      where: { userId_itemKey: { userId, itemKey } },
      update: { checked: true, atHome: false, checkedAt: new Date() },
      create: { userId, itemKey, checked: true },
    });
  } else {
    await prisma.shoppingCheck.deleteMany({ where: { userId, itemKey } });
  }
}

/**
 * Mark an item as already at home (it moves out of the list into the "At
 * home" section and stays there until unmarked), or back to needed.
 */
export async function setAtHomeAction(
  itemKey: string,
  atHome: boolean,
): Promise<void> {
  const userId = await requireUserId();
  if (!itemKey || itemKey.length > 300) return;

  if (atHome) {
    await prisma.shoppingCheck.upsert({
      where: { userId_itemKey: { userId, itemKey } },
      update: { checked: false, atHome: true, checkedAt: new Date() },
      create: { userId, itemKey, checked: false, atHome: true },
    });
  } else {
    await prisma.shoppingCheck.deleteMany({ where: { userId, itemKey } });
  }
  revalidatePath("/shopping");
}

/**
 * File an item under a different aisle. Picking the aisle we'd have guessed
 * anyway just drops the override.
 */
export async function setItemAisleAction(
  name: string,
  aisle: string,
): Promise<void> {
  const userId = await requireUserId();
  const key = aisleKey(name);
  if (!key || key.length > 200 || !isAisle(aisle)) return;

  if (guessAisle(name) === aisle) {
    await prisma.shoppingAisle.deleteMany({ where: { userId, name: key } });
  } else {
    await prisma.shoppingAisle.upsert({
      where: { userId_name: { userId, name: key } },
      update: { aisle },
      create: { userId, name: key, aisle },
    });
  }
  revalidatePath("/shopping");
}

/** Clear this trip's ticks. Items marked "at home" stay put. */
export async function clearCheckedAction(): Promise<void> {
  const userId = await requireUserId();
  await prisma.shoppingCheck.deleteMany({ where: { userId, atHome: false } });
  revalidatePath("/shopping");
}
