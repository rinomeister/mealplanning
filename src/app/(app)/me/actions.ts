"use server";

import { refresh, revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { bodyweightSchema } from "@/lib/schemas";
import { keyToDbDate } from "@/lib/dates";
import { parseDecimal } from "@/lib/utils";
import { PROFILE_FIELDS, DEFAULT_TARGETS, type ProfileField } from "@/lib/profile-fields";

type Result = { ok: true } | { ok: false; error: string };

function revalidateMe() {
  revalidatePath("/me");
  revalidatePath("/me/progress");
  revalidatePath("/");
  revalidatePath("/today");
}

/** One row on Me: a target, your name or your height. Empty clears it. */
export async function updateProfileFieldAction(key: string, raw: string): Promise<Result> {
  const userId = await requireUserId();
  const field = PROFILE_FIELDS[key as ProfileField];
  if (!field) return { ok: false, error: "Unknown setting." };
  const text = raw.trim();

  let value: string | number | null;
  if (field.kind === "text") {
    if (text.length > 80) return { ok: false, error: "Keep it under 80 characters." };
    value = text || null;
  } else if (!text) {
    value = null;
  } else {
    const n = parseDecimal(text);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Type a number." };
    if (n > field.max) return { ok: false, error: `That's more than ${field.max} ${field.unit}.` };
    value = field.kind === "int" ? Math.round(n) : Math.round(n * 10) / 10;
  }
  await prisma.user.update({ where: { id: userId }, data: { [field.column]: value } });
  revalidateMe();
  return { ok: true };
}

/** Units only change the display, so refresh the page in this response. */
export async function updateUnitsAction(units: string): Promise<Result> {
  const userId = await requireUserId();
  if (units !== "METRIC" && units !== "IMPERIAL") return { ok: false, error: "Unknown units." };
  await prisma.user.update({ where: { id: userId }, data: { units } });
  revalidateMe();
  refresh();
  return { ok: true };
}

/** "Skip and use defaults" after sign-up: fills only the targets still empty. */
export async function applyDefaultTargetsAction(): Promise<Result> {
  const userId = await requireUserId();
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { targetKcal: true, targetProtein: true, targetFat: true, targetCarbs: true, targetSugar: true, targetFiber: true },
  });
  const data: Record<string, number> = {};
  for (const [col, v] of Object.entries(DEFAULT_TARGETS)) {
    if (u[col as keyof typeof u] == null) data[col] = v;
  }
  if (Object.keys(data).length) await prisma.user.update({ where: { id: userId }, data });
  revalidateMe();
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
  revalidateMe();
  return { ok: true };
}

export async function deleteBodyweightAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.bodyweightLog.deleteMany({ where: { id, userId } });
  revalidateMe();
}
