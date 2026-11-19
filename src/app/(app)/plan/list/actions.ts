"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { aisleKey, guessAisle } from "@/lib/aisles";
import { loadAisles, parseAisleOrder, type AisleDef } from "@/lib/shopping-list";

function revalidateList() {
  revalidatePath("/plan/list");
  revalidatePath("/plan");
  revalidatePath("/");
}

/** Tick a plan item as bought (or untick it). The row updates optimistically. */
export async function toggleShoppingCheckAction(itemKey: string, checked: boolean): Promise<void> {
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
  revalidatePath("/");
}

/** Already at home: off the list until unmarked (staples like salt). */
export async function setAtHomeAction(itemKey: string, atHome: boolean): Promise<void> {
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
  revalidateList();
}

/** File a plan item under another aisle; the guessed aisle just drops the override. */
export async function setItemAisleAction(name: string, aisle: string): Promise<void> {
  const userId = await requireUserId();
  const key = aisleKey(name);
  const aisles = await loadAisles(userId);
  if (!key || key.length > 200 || !aisles.some((a) => a.key === aisle)) return;
  if (guessAisle(name) === aisle) {
    await prisma.shoppingAisle.deleteMany({ where: { userId, name: key } });
  } else {
    await prisma.shoppingAisle.upsert({
      where: { userId_name: { userId, name: key } },
      update: { aisle },
      create: { userId, name: key, aisle },
    });
  }
  revalidateList();
}

/** Clear this trip: plan ticks go, ticked own items are removed. At-home stays. */
export async function clearCheckedAction(): Promise<void> {
  const userId = await requireUserId();
  await prisma.$transaction([
    prisma.shoppingCheck.deleteMany({ where: { userId, atHome: false } }),
    prisma.shoppingExtra.deleteMany({ where: { userId, checked: true } }),
  ]);
  revalidateList();
}

// ---- Own items ("dish soap")

export async function addExtraAction(input: {
  name: string;
  amount?: string;
  aisle?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Type what you need." };
  const aisles = await loadAisles(userId);
  const aisle = input.aisle && aisles.some((a) => a.key === input.aisle) ? input.aisle : null;
  const row = await prisma.shoppingExtra.create({
    data: { userId, name, amount: input.amount?.trim().slice(0, 40) || null, aisle },
    select: { id: true },
  });
  revalidateList();
  return { ok: true, id: row.id };
}

export async function toggleExtraAction(id: string, checked: boolean): Promise<void> {
  const userId = await requireUserId();
  await prisma.shoppingExtra.updateMany({ where: { id, userId }, data: { checked } });
  revalidatePath("/");
}

export async function removeExtraAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.shoppingExtra.deleteMany({ where: { id, userId } });
  revalidateList();
}

export async function setExtraAisleAction(id: string, aisle: string): Promise<void> {
  const userId = await requireUserId();
  const aisles = await loadAisles(userId);
  if (!aisles.some((a) => a.key === aisle)) return;
  await prisma.shoppingExtra.updateMany({ where: { id, userId }, data: { aisle } });
  revalidateList();
}

// ---- Aisles

/**
 * Save the aisles in store order (rename, add, delete, reorder). Items filed
 * under a deleted aisle fall back to their guess, or Other.
 */
export async function setAisleOrderAction(order: AisleDef[]): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const clean = parseAisleOrder(order.map((a) => ({ key: a.key, label: a.label.trim() || "Aisle" })));
  await prisma.user.update({ where: { id: userId }, data: { aisleOrder: clean } });
  const keys = clean.map((a) => a.key);
  await prisma.$transaction([
    prisma.shoppingAisle.deleteMany({ where: { userId, aisle: { notIn: [...keys, "other"] } } }),
    prisma.shoppingExtra.updateMany({ where: { userId, aisle: { notIn: [...keys, "other"] } }, data: { aisle: null } }),
  ]);
  revalidateList();
  return { ok: true };
}
