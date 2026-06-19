"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { bodyweightSchema, profileSchema } from "@/lib/schemas";
import { keyToDbDate } from "@/lib/dates";

type Result = { ok: true } | { ok: false; error: string };

export async function updateProfileAction(input: unknown): Promise<Result> {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: d.name,
      heightCm: d.heightCm,
      targetKcal: d.targetKcal != null ? Math.round(d.targetKcal) : null,
      targetProtein: d.targetProtein != null ? Math.round(d.targetProtein) : null,
      targetFat: d.targetFat != null ? Math.round(d.targetFat) : null,
      targetCarbs: d.targetCarbs != null ? Math.round(d.targetCarbs) : null,
      units: d.units,
    },
  });
  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}

export async function addBodyweightAction(input: unknown): Promise<Result> {
  const userId = await requireUserId();
  const parsed = bodyweightSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { weightKg, recordedAt, note } = parsed.data;
  await prisma.bodyweightLog.upsert({
    where: { userId_recordedAt: { userId, recordedAt: keyToDbDate(recordedAt) } },
    update: { weightKg, note },
    create: { userId, weightKg, recordedAt: keyToDbDate(recordedAt), note },
  });
  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteBodyweightAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.bodyweightLog.deleteMany({ where: { id, userId } });
  revalidatePath("/profile");
  revalidatePath("/");
}
