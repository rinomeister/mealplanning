"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { planEntrySchema } from "@/lib/schemas";
import { keyToDbDate } from "@/lib/dates";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function addPlanEntryAction(input: {
  date: string;
  slot: string;
  mealId: string;
  servings: number | string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = planEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };
  const { date, slot, mealId, servings } = parsed.data;

  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: { id: true },
  });
  if (!meal) return { ok: false, error: "Meal not found." };

  // Place new entry at the end of the slot.
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
      mealId,
      servings,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/calendar/${date}`);
  revalidatePath("/calendar");
  revalidatePath("/track");
  return { ok: true };
}

export async function removePlanEntryAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const entry = await prisma.planEntry.findFirst({
    where: { id, userId },
    select: { date: true },
  });
  if (!entry) return { ok: false, error: "Entry not found." };

  await prisma.planEntry.delete({ where: { id } });
  revalidatePath(`/calendar/${entry.date.toISOString().slice(0, 10)}`);
  revalidatePath("/calendar");
  revalidatePath("/track");
  return { ok: true };
}

export async function setServingsAction(
  id: string,
  servings: number,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!Number.isFinite(servings) || servings <= 0) {
    return { ok: false, error: "Servings must be positive." };
  }
  const { count } = await prisma.planEntry.updateMany({
    where: { id, userId },
    data: { servings },
  });
  if (count === 0) return { ok: false, error: "Entry not found." };
  revalidatePath("/calendar");
  revalidatePath("/track");
  return { ok: true };
}

export async function setEntryStatusAction(
  id: string,
  status: "PLANNED" | "EATEN" | "SKIPPED",
): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await prisma.planEntry.updateMany({
    where: { id, userId },
    data: { status },
  });
  if (count === 0) return { ok: false, error: "Entry not found." };
  revalidatePath("/calendar");
  revalidatePath("/track");
  return { ok: true };
}
