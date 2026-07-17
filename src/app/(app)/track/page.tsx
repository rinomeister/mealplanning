import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { GoalProgress } from "@/components/goal-progress";
import { PlanEntryRow, type DayEntry } from "@/components/day-planner";
import { AddFoodControl } from "@/components/day-tracker";
import { SlotMacros } from "@/components/slot-macros";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { addDaysKey, formatLong, keyToDbDate, todayKey } from "@/lib/dates";
import {
  fmtMacro,
  sumDayEntries,
  type EntryForMacros,
  type MealMacros,
} from "@/lib/macros";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type MacroCols = {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sugar: number | null;
  fiber: number | null;
};

function toMealMacros(m: MacroCols): MealMacros {
  return {
    kcal: m.kcal,
    protein: m.protein,
    fat: m.fat,
    carbs: m.carbs,
    sugar: m.sugar,
    fiber: m.fiber,
  };
}

function hasMacros(m: MacroCols): boolean {
  return (
    m.kcal != null ||
    m.protein != null ||
    m.fat != null ||
    m.carbs != null ||
    m.sugar != null ||
    m.fiber != null
  );
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const userId = await requireUserId();
  const { date: dateParam } = await searchParams;
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayKey();

  const [user, entries, mealRecords, tags] = await Promise.all([
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
      orderBy: [{ slot: "asc" }, { position: "asc" }],
      include: {
        meal: {
          select: {
            id: true,
            name: true,
            kcal: true,
            protein: true,
            fat: true,
            carbs: true,
            sugar: true,
            fiber: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            kcal: true,
            protein: true,
            fat: true,
            carbs: true,
            sugar: true,
            fiber: true,
          },
        },
      },
    }),
    prisma.meal.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kcal: true, tags: { select: { tagId: true } } },
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const meals = mealRecords.map((m) => ({
    id: m.id,
    name: m.name,
    kcal: m.kcal,
    tagIds: m.tags.map((t) => t.tagId),
  }));

  type Entry = (typeof entries)[number];
  const forMacros = (e: Entry): EntryForMacros => ({
    servings: e.servings,
    grams: e.grams,
    meal: e.meal ? toMealMacros(e.meal) : null,
    product: e.product ? toMealMacros(e.product) : null,
  });

  const counted = entries.filter((e) => e.status !== "SKIPPED");
  const totals = sumDayEntries(counted.map(forMacros));

  const uncounted = counted.filter((e) => {
    const item = e.product ?? e.meal;
    return !item || !hasMacros(item);
  }).length;

  const targets = {
    kcal: user?.targetKcal ?? null,
    protein: user?.targetProtein ?? null,
    fat: user?.targetFat ?? null,
    carbs: user?.targetCarbs ?? null,
    sugar: user?.targetSugar ?? null,
    fiber: user?.targetFiber ?? null,
  };

  const bySlot = new Map<SlotKey, typeof entries>();
  for (const slot of SLOTS) bySlot.set(slot, []);
  for (const e of entries) bySlot.get(e.slot as SlotKey)?.push(e);

  const isToday = date === todayKey();

  return (
    <>
      <PageHeader title="Track" description="Log what you eat and track it against your goals." />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/track?date=${addDaysKey(date, -1)}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted active:bg-muted"
          aria-label="Previous day"
        >
          <ChevronLeft className="size-6" />
        </Link>
        <div className="text-center">
          <p className="text-lg font-semibold">
            {isToday ? "Today" : formatLong(date)}
          </p>
          <Link
            href={`/calendar/${date}`}
            className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground hover:underline"
          >
            <CalendarDays className="size-4" /> Plan this day
          </Link>
        </div>
        <Link
          href={`/track?date=${addDaysKey(date, 1)}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted active:bg-muted"
          aria-label="Next day"
        >
          <ChevronRight className="size-6" />
        </Link>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Daily goals</h2>
            <p className="shrink-0 text-sm text-muted-foreground">
              {counted.length} item{counted.length === 1 ? "" : "s"}
            </p>
          </div>
          <GoalProgress totals={totals} targets={targets} />
          {uncounted > 0 && (
            <p className="text-sm text-amber-600">
              {uncounted} item{uncounted === 1 ? "" : "s"} have no macros and aren&apos;t counted.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {SLOTS.map((slot) => {
          const slotEntries = bySlot.get(slot) ?? [];
          const slotCounted = slotEntries.filter((e) => e.status !== "SKIPPED");
          const slotTotals = sumDayEntries(slotCounted.map(forMacros));
          return (
            <Card key={slot}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold">{SLOT_LABELS[slot]}</h2>
                    {slotCounted.length > 0 ? (
                      <span className="shrink-0 text-lg font-bold tabular-nums">
                        {fmtMacro(slotTotals.kcal, "kcal")}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          kcal
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        Nothing logged
                      </span>
                    )}
                  </div>
                  {slotCounted.length > 0 && <SlotMacros macros={slotTotals} />}
                </div>
                {slotEntries.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {slotEntries.map((e) => {
                      const item = e.product ?? e.meal;
                      const dayEntry: DayEntry = {
                        id: e.id,
                        kind: e.product ? "product" : "meal",
                        name: item?.name ?? "(removed)",
                        href: e.meal ? `/meals/${e.meal.id}` : null,
                        servings: e.servings,
                        grams: e.grams,
                        status: e.status,
                        kcalBasis: item?.kcal ?? null,
                        hasMacros: item ? hasMacros(item) : false,
                      };
                      return <PlanEntryRow key={e.id} entry={dayEntry} />;
                    })}
                  </div>
                )}
                <AddFoodControl
                  date={date}
                  slot={slot}
                  slotLabel={SLOT_LABELS[slot]}
                  meals={meals}
                  tags={tags}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
