import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { getSessionUser } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MacroSummary } from "@/components/macro-summary";
import { addDaysKey, keyToDbDate, todayKey } from "@/lib/dates";
import { sumEntries } from "@/lib/macros";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const user = await getSessionUser();
  const today = todayKey();
  const weekEnd = addDaysKey(today, 6);

  const [todayEntries, weekCount, mealCount, weights, dbUser] = await Promise.all([
    prisma.planEntry.findMany({
      where: { userId, date: keyToDbDate(today), status: { not: "SKIPPED" } },
      include: {
        meal: {
          select: { kcal: true, protein: true, fat: true, carbs: true },
        },
      },
    }),
    prisma.planEntry.count({
      where: {
        userId,
        date: { gte: keyToDbDate(today), lte: keyToDbDate(weekEnd) },
        status: { not: "SKIPPED" },
      },
    }),
    prisma.meal.count({ where: { userId } }),
    prisma.bodyweightLog.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 2,
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        units: true,
        targetKcal: true,
        targetProtein: true,
        targetFat: true,
        targetCarbs: true,
      },
    }),
  ]);

  const totals = sumEntries(
    todayEntries.map((e) => ({ servings: e.servings, meal: e.meal })),
  );

  const units = dbUser.units as UnitSystem;
  const latest = weights[0];
  const prev = weights[1];
  const weightDelta =
    latest && prev ? latest.weightKg - prev.weightKg : null;

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
        {/* Today */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Today</CardTitle>
            <Link
              href={`/calendar/${today}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Plan today <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {todayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing planned yet.{" "}
                <Link href={`/calendar/${today}`} className="text-primary hover:underline">
                  Add meals
                </Link>
                .
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {todayEntries.length} meal{todayEntries.length === 1 ? "" : "s"} planned
                </p>
                <MacroSummary
                  macros={totals}
                  targets={{
                    kcal: dbUser.targetKcal,
                    protein: dbUser.targetProtein,
                    fat: dbUser.targetFat,
                    carbs: dbUser.targetCarbs,
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={<UtensilsCrossed className="size-5" />}
            value={mealCount}
            label={mealCount === 1 ? "meal saved" : "meals saved"}
            href="/meals"
          />
          <StatCard
            icon={<CalendarDays className="size-5" />}
            value={weekCount}
            label="planned next 7 days"
            href="/calendar"
          />
        </div>

        {/* Weight */}
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
            {latest ? (
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-semibold">
                  {kgToDisplay(latest.weightKg, units)} {weightLabel(units)}
                </span>
                {weightDelta != null && Math.abs(weightDelta) > 0.0001 && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-sm",
                      weightDelta < 0 ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {weightDelta < 0 ? (
                      <TrendingDown className="size-4" />
                    ) : (
                      <TrendingUp className="size-4" />
                    )}
                    {kgToDisplay(Math.abs(weightDelta), units)} {weightLabel(units)}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No entries yet.{" "}
                <Link href="/profile" className="text-primary hover:underline">
                  Add your weight
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>

        {/* Shopping shortcut */}
        <Link
          href="/shopping"
          className={cn(buttonVariants({ variant: "outline" }), "h-12 justify-between")}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-5" /> Build shopping list
          </span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

function StatCard({
  icon,
  value,
  label,
  href,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardContent className="flex flex-col gap-1">
          <span className="text-primary">{icon}</span>
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
