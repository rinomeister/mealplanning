"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { randomInt } from "node:crypto";
import { SHARE_ALPHABET, parseShareCode } from "@/lib/share";

/** A fresh random 8-character share code (stored without the dash). */
function generateShareCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += SHARE_ALPHABET[randomInt(SHARE_ALPHABET.length)];
  return code;
}

type ShareResult = { ok: true; code: string } | { ok: false; error: string };

/** Get (or create) the share code for one of your meals. */
export async function createMealShareAction(mealId: string): Promise<ShareResult> {
  const userId = await requireUserId();
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: { id: true, share: { select: { code: true } } },
  });
  if (!meal) return { ok: false, error: "Meal not found." };
  if (meal.share) return { ok: true, code: meal.share.code };

  // 31^8 ≈ 850 billion codes; a clash is near impossible, but retry anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    try {
      await prisma.mealShare.create({ data: { code, mealId } });
      revalidatePath(`/meals/${mealId}`);
      return { ok: true, code };
    } catch {
      const existing = await prisma.mealShare.findUnique({
        where: { mealId },
        select: { code: true },
      });
      if (existing) return { ok: true, code: existing.code };
    }
  }
  return { ok: false, error: "Couldn't create a share code — try again." };
}

/** Stop sharing: the old code stops working. Copies already imported stay. */
export async function revokeMealShareAction(
  mealId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  await prisma.mealShare.deleteMany({ where: { mealId, meal: { userId } } });
  revalidatePath(`/meals/${mealId}`);
  return { ok: true };
}

/**
 * Import a shared meal as your own independent copy: name, steps, servings,
 * macros, ingredients (with any scanned macros) and tags — matched to your tags
 * by name, created if you don't have them. Redirects to the new meal.
 */
export async function importSharedMealAction(
  rawCode: string,
): Promise<{ ok: false; error: string }> {
  const userId = await requireUserId();
  const code = parseShareCode(rawCode);
  if (!code) return { ok: false, error: "That isn't a valid share code." };

  const share = await prisma.mealShare.findUnique({
    where: { code },
    include: {
      meal: {
        include: {
          ingredients: { orderBy: { position: "asc" } },
          tags: { include: { tag: { select: { name: true, color: true } } } },
        },
      },
    },
  });
  if (!share) {
    return { ok: false, error: "This code doesn't work any more — ask for a new one." };
  }
  const src = share.meal;
  if (src.userId === userId) {
    return { ok: false, error: "That's already your meal." };
  }

  const tagIds: string[] = [];
  for (const { tag } of src.tags) {
    const t = await prisma.tag.upsert({
      where: { userId_name: { userId, name: tag.name } },
      update: {},
      create: { userId, name: tag.name, color: tag.color },
      select: { id: true },
    });
    tagIds.push(t.id);
  }

  const created = await prisma.meal.create({
    data: {
      userId,
      name: src.name,
      prepSteps: src.prepSteps,
      servingLabel: src.servingLabel,
      serves: src.serves,
      macrosManual: src.macrosManual,
      kcal: src.kcal,
      protein: src.protein,
      fat: src.fat,
      carbs: src.carbs,
      sugar: src.sugar,
      fiber: src.fiber,
      ingredients: {
        create: src.ingredients.map((ing, i) => ({
          name: ing.name,
          qty: ing.qty,
          unit: ing.unit,
          note: ing.note,
          position: i,
          barcode: ing.barcode,
          kcal: ing.kcal,
          protein: ing.protein,
          fat: ing.fat,
          carbs: ing.carbs,
          sugar: ing.sugar,
          fiber: ing.fiber,
        })),
      },
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
    select: { id: true },
  });

  await prisma.mealShare.update({
    where: { id: share.id },
    data: { imports: { increment: 1 } },
  });

  revalidatePath("/meals");
  redirect(`/meals/${created.id}?imported=1`);
}
