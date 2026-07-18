import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId, getSessionUser } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalProgress } from "@/components/goal-progress";
import { BodyweightTrend, type TrendPoint } from "@/components/bodyweight-trend";
import { dbDateToKey, keyToDbDate, todayKey } from "@/lib/dates";
import { sumDayEntries } from "@/lib/macros";
import type { UnitSystem } from "@/lib/units";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const user = await getSessionUser();
  const today = todayKey();

  const [todayEntries, weights, dbUser] = await Promise.all([
    prisma.planEntry.findMany({
      where: { userId, date: keyToDbDate(today), status: { not: "SKIPPED" } },
      include: {
        meal: {
          select: { kcal: true, protein: true, fat: true, carbs: true, sugar: true, fiber: true },
        },
        product: {
          select: { kcal: true, protein: true, fat: true, carbs: true, sugar: true, fiber: true },
        },
      },
    }),
    prisma.bodyweightLog.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 30,
      select: { recordedAt: true, weightKg: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        units: true,
        targetKcal: true,
        targetProtein: true,
        targetFat: true,
        targetCarbs: true,
        targetSugar: true,
        targetFiber: true,
      },
    }),
  ]);

  const totals = sumDayEntries(
    todayEntries.map((e) => ({
      servings: e.servings,
      grams: e.grams,
      meal: e.meal
        ? {
            kcal: e.meal.kcal,
            protein: e.meal.protein,
            fat: e.meal.fat,
            carbs: e.meal.carbs,
            sugar: e.meal.sugar,
            fiber: e.meal.fiber,
          }
        : null,
      product: e.product
        ? {
            kcal: e.product.kcal,
            protein: e.product.protein,
            fat: e.product.fat,
            carbs: e.product.carbs,
            sugar: e.product.sugar,
            fiber: e.product.fiber,
          }
        : null,
    })),
  );

  const units = dbUser.units as UnitSystem;
  const points: TrendPoint[] = weights.map((w) => ({
    date: dbDateToKey(w.recordedAt),
    weightKg: w.weightKg,
  }));

  const firstName = (user?.name || user?.email || "there").split(" ")[0];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Hi, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s your day at a glance.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Today's macros against goals — the daily headline. */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">
              Today
              <span className="ml-2 font-normal text-muted-foreground">
                {todayEntries.length === 0
                  ? "nothing logged yet"
                  : `${todayEntries.length} item${todayEntries.length === 1 ? "" : "s"}`}
              </span>
            </CardTitle>
            <Link
              href="/track"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Track today <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <GoalProgress
              totals={totals}
              targets={{
                kcal: dbUser.targetKcal,
                protein: dbUser.targetProtein,
                fat: dbUser.targetFat,
                carbs: dbUser.targetCarbs,
                sugar: dbUser.targetSugar,
                fiber: dbUser.targetFiber,
              }}
            />
          </CardContent>
        </Card>

        {/* Bodyweight trend. */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Bodyweight</CardTitle>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Log <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <BodyweightTrend points={points} units={units} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
