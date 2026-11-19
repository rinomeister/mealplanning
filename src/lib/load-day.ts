import { prisma } from "@/lib/prisma";
import { keyToDbDate } from "@/lib/dates";
import { sumByStatus, type DayTotals, type Targets } from "@/lib/macro-format";

/** A user's targets and a day's eaten/planned totals — context for add flows. */
export async function loadDayContext(
  userId: string,
  date: string,
): Promise<{ targets: Targets; totals: DayTotals }> {
  const [user, entries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        targetKcal: true,
        targetProtein: true,
        targetFat: true,
        targetCarbs: true,
        targetSugar: true,
        targetFiber: true,
      },
    }),
    prisma.planEntry.findMany({
      where: { userId, date: keyToDbDate(date) },
      select: {
        status: true,
        servings: true,
        grams: true,
        productId: true,
        kcal: true,
        protein: true,
        fat: true,
        carbs: true,
        sugar: true,
        fiber: true,
      },
    }),
  ]);
  return {
    targets: {
      kcal: user?.targetKcal ?? null,
      protein: user?.targetProtein ?? null,
      fat: user?.targetFat ?? null,
      carbs: user?.targetCarbs ?? null,
      sugar: user?.targetSugar ?? null,
      fiber: user?.targetFiber ?? null,
    },
    totals: sumByStatus(entries),
  };
}

/** Just the user's daily targets. */
export async function loadTargets(userId: string): Promise<Targets> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { targetKcal: true, targetProtein: true, targetFat: true, targetCarbs: true, targetSugar: true, targetFiber: true },
  });
  return {
    kcal: u?.targetKcal ?? null,
    protein: u?.targetProtein ?? null,
    fat: u?.targetFat ?? null,
    carbs: u?.targetCarbs ?? null,
    sugar: u?.targetSugar ?? null,
    fiber: u?.targetFiber ?? null,
  };
}
