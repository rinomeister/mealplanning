"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";

export async function toggleShoppingCheckAction(
  itemKey: string,
  checked: boolean,
): Promise<void> {
  const userId = await requireUserId();
  if (!itemKey) return;

  if (checked) {
    await prisma.shoppingCheck.upsert({
      where: { userId_itemKey: { userId, itemKey } },
      update: { checked: true, checkedAt: new Date() },
      create: { userId, itemKey, checked: true },
    });
  } else {
    await prisma.shoppingCheck.deleteMany({ where: { userId, itemKey } });
  }
}

export async function clearCheckedAction(): Promise<void> {
  const userId = await requireUserId();
  await prisma.shoppingCheck.deleteMany({ where: { userId } });
  revalidatePath("/shopping");
}
