"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { mealSchema, tagSchema, type MealInputRaw } from "@/lib/schemas";
import {
  countUpcomingEntries,
  deleteMealKeepingHistory,
  refreshUpcomingEntries,
  rescaleUpcomingBatchEntries,
} from "@/lib/entries";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

async function upsertMealData(userId: string, input: MealInputRaw) {
  const data = mealSchema.parse(input);

  // Only keep tag ids that actually belong to this user.
  const ownedTags = await prisma.tag.findMany({
    where: { userId, id: { in: data.tagIds } },
    select: { id: true },
  });
  const tagIds = ownedTags.map((t) => t.id);

  return { data, tagIds };
}

export async function createMealAction(
  input: MealInputRaw,
): Promise<SaveResult> {
  const userId = await requireUserId();
  let created;
  try {
    const { data, tagIds } = await upsertMealData(userId, input);
    created = await prisma.meal.create({
      data: {
        userId,
        name: data.name,
        prepSteps: data.prepSteps,
        servingLabel: data.servingLabel,
        serves: data.serves,
        cookedGrams: data.cookedGrams,
        macrosManual: data.macrosManual,
        kcal: data.kcal,
        protein: data.protein,
        fat: data.fat,
        carbs: data.carbs,
        sugar: data.sugar,
        fiber: data.fiber,
        ingredients: {
          create: data.ingredients.map((ing, i) => ({
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
    });
  } catch (e) {
    return { ok: false, error: messageFrom(e) };
  }
  revalidatePath("/meals");
  redirect(`/meals/${created.id}`);
}

export async function updateMealAction(
  id: string,
  input: MealInputRaw,
): Promise<SaveResult> {
  const userId = await requireUserId();
  try {
    const existing = await prisma.meal.findFirst({
      where: { id, userId },
      select: { id: true, cookedGrams: true, serves: true },
    });
    if (!existing) return { ok: false, error: "Meal not found." };

    const { data, tagIds } = await upsertMealData(userId, input);

    // Replace ingredients and tag links wholesale (simplest correct approach).
    await prisma.$transaction([
      prisma.ingredient.deleteMany({ where: { mealId: id } }),
      prisma.mealTag.deleteMany({ where: { mealId: id } }),
      prisma.meal.update({
        where: { id },
        data: {
          name: data.name,
          prepSteps: data.prepSteps,
          servingLabel: data.servingLabel,
          serves: data.serves,
          cookedGrams: data.cookedGrams,
          macrosManual: data.macrosManual,
          kcal: data.kcal,
          protein: data.protein,
          fat: data.fat,
          carbs: data.carbs,
          sugar: data.sugar,
          fiber: data.fiber,
          ingredients: {
            create: data.ingredients.map((ing, i) => ({
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
      }),
    ]);
    // Today and future days pick up the new macros; past days keep theirs.
    await refreshUpcomingEntries({ mealId: id }, data);
    if (existing.cookedGrams !== data.cookedGrams || existing.serves !== data.serves) {
      await rescaleUpcomingBatchEntries(id, data);
    }
  } catch (e) {
    return { ok: false, error: messageFrom(e) };
  }
  revalidatePath("/meals");
  revalidatePath(`/meals/${id}`);
  revalidatePath("/track");
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
  redirect(`/meals/${id}`);
}

/**
 * Record how much this batch weighs once cooked (or clear it), straight from
 * the meal page — the number changes every time you cook it.
 */
export async function setCookedWeightAction(
  id: string,
  grams: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (grams != null && (!Number.isFinite(grams) || grams <= 0 || grams > 100000)) {
    return { ok: false, error: "Enter the weight in grams." };
  }
  const meal = await prisma.meal.findFirst({
    where: { id, userId },
    select: { serves: true },
  });
  if (!meal) return { ok: false, error: "Meal not found." };

  await prisma.meal.update({ where: { id }, data: { cookedGrams: grams } });
  await rescaleUpcomingBatchEntries(id, { cookedGrams: grams, serves: meal.serves });

  revalidatePath(`/meals/${id}`);
  revalidatePath("/track");
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
  return { ok: true };
}

/** Star or unstar a meal; favorites sit at the top of the meal picker. */
export async function setMealFavoriteAction(
  id: string,
  favorite: boolean,
): Promise<void> {
  const userId = await requireUserId();
  await prisma.meal.updateMany({ where: { id, userId }, data: { favorite } });
  revalidatePath("/track");
  revalidatePath("/meals");
  revalidatePath(`/meals/${id}`);
}

/** For the delete confirmation: upcoming, uneaten plans that would be removed. */
export async function mealUpcomingCountAction(id: string): Promise<number> {
  const userId = await requireUserId();
  return countUpcomingEntries({ mealId: id }, userId);
}

export async function deleteMealAction(
  id: string,
): Promise<{ ok: false; error: string } | void> {
  const userId = await requireUserId();
  const meal = await prisma.meal.findFirst({
    where: { id, userId },
    select: { id: true, name: true },
  });
  if (!meal) return { ok: false, error: "Meal not found." };
  // Past days keep it (by name, with their numbers); upcoming plans go.
  await deleteMealKeepingHistory(meal);
  revalidatePath("/meals");
  revalidatePath("/track");
  revalidatePath("/calendar", "layout");
  revalidatePath("/shopping");
  revalidatePath("/");
  redirect("/meals");
}

export async function createTagAction(
  name: string,
  color?: string,
): Promise<{ id: string; name: string; color: string | null } | { error: string }> {
  const userId = await requireUserId();
  const parsed = tagSchema.safeParse({ name, color });
  if (!parsed.success) return { error: "Invalid tag name." };

  try {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name: parsed.data.name } },
      update: {},
      create: { userId, name: parsed.data.name, color: parsed.data.color ?? null },
      select: { id: true, name: true, color: true },
    });
    revalidatePath("/meals");
    return tag;
  } catch {
    return { error: "Could not create tag." };
  }
}

function messageFrom(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
