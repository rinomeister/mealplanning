"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { mealSchema, tagSchema, type MealInputRaw } from "@/lib/schemas";

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
      select: { id: true },
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
  } catch (e) {
    return { ok: false, error: messageFrom(e) };
  }
  revalidatePath("/meals");
  revalidatePath(`/meals/${id}`);
  redirect(`/meals/${id}`);
}

export async function deleteMealAction(
  id: string,
): Promise<{ ok: false; error: string } | void> {
  const userId = await requireUserId();
  const meal = await prisma.meal.findFirst({
    where: { id, userId },
    select: { id: true, _count: { select: { planEntries: true } } },
  });
  if (!meal) return { ok: false, error: "Meal not found." };
  if (meal._count.planEntries > 0) {
    return {
      ok: false,
      error:
        "This meal is still used in your calendar. Remove it from those days first.",
    };
  }
  await prisma.meal.delete({ where: { id } });
  revalidatePath("/meals");
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
