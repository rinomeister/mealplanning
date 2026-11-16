import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { GoalProgress } from "@/components/goal-progress";
import { PlanEntryRow } from "@/components/day-planner";
import { AddFoodControl } from "@/components/day-tracker";
import { SlotActionsMenu } from "@/components/slot-actions-menu";
import { DayCopyMenu } from "@/components/day-copy-menu";
import { RemainingCard } from "@/components/remaining-card";
import { SlotMacros } from "@/components/slot-macros";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { addDaysKey, formatLong, keyToDbDate, todayKey } from "@/lib/dates";
import {
  fmtMacro,
  gramsPerServing,
  hasAnyMacro,
  sumDayEntries,
} from "@/lib/macros";
import { toDayEntry } from "@/lib/day-entry";
import { loadPickerProducts } from "@/lib/meal-form-products";
import { loadMealUsage, loadProductUsage } from "@/lib/load-usage";
import { SaveSlotMealButton } from "@/components/save-slot-meal";
import { nextOpenSlot, remainingMacros, suggestMeals } from "@/lib/suggest";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const userId = await requireUserId();
  const { date: dateParam } = await searchParams;
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayKey();

  const [user, entries, mealRecords, tags, products, productUsage, mealUsage] =
    await Promise.all([
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
        meal: { select: { name: true, cookedGrams: true, serves: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.meal.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kcal: true,
        protein: true,
        fat: true,
        carbs: true,
        sugar: true,
        fiber: true,
        favorite: true,
        cookedGrams: true,
        serves: true,
        tags: { select: { tagId: true } },
      },
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    loadPickerProducts(),
    loadProductUsage(userId),
    loadMealUsage(userId),
  ]);

  const meals = mealRecords.map((m) => ({
    id: m.id,
    name: m.name,
    kcal: m.kcal,
    tagIds: m.tags.map((t) => t.tagId),
    favorite: m.favorite,
    gramsPerServing: gramsPerServing(m),
  }));

  const counted = entries.filter((e) => e.status !== "SKIPPED");
  const totals = sumDayEntries(counted);

  const uncounted = counted.filter((e) => !hasAnyMacro(e)).length;

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

  const remaining = remainingMacros(totals, targets);
  const suggestions = suggestMeals(mealRecords, remaining);
  const filledSlots = new Set(counted.map((e) => e.slot as SlotKey));

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
          <div className="flex flex-wrap items-center justify-center gap-x-4">
            <Link
              href={`/calendar/${date}`}
              className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground hover:underline"
            >
              <CalendarDays className="size-4" /> Plan this day
            </Link>
            {entries.length > 0 && <DayCopyMenu date={date} isEmpty={false} />}
          </div>
        </div>
        <Link
          href={`/track?date=${addDaysKey(date, 1)}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted active:bg-muted"
          aria-label="Next day"
        >
          <ChevronRight className="size-6" />
        </Link>
      </div>

      {entries.length === 0 && <DayCopyMenu date={date} isEmpty />}

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

      <RemainingCard
        date={date}
        isToday={isToday}
        remaining={remaining}
        suggestions={suggestions}
        defaultSlot={nextOpenSlot(filledSlots)}
      />

      <div className="flex flex-col gap-3">
        {SLOTS.map((slot) => {
          const slotEntries = bySlot.get(slot) ?? [];
          const slotCounted = slotEntries.filter((e) => e.status !== "SKIPPED");
          const slotTotals = sumDayEntries(slotCounted);
          // Worth saving as a meal: several items, or anything that isn't
          // already a single saved meal.
          const saveable =
            slotCounted.length >= 2 || slotCounted.some((e) => !e.mealId);
          return (
            <Card key={slot}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{SLOT_LABELS[slot]}</h2>
                    <div className="flex shrink-0 items-center gap-1">
                      {slotCounted.length > 0 ? (
                        <span className="text-lg font-bold tabular-nums">
                          {fmtMacro(slotTotals.kcal, "kcal")}
                          <span className="ml-1 text-sm font-normal text-muted-foreground">
                            kcal
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Nothing logged
                        </span>
                      )}
                      <SlotActionsMenu
                        date={date}
                        slot={slot}
                        slotLabel={SLOT_LABELS[slot]}
                        hasEntries={slotCounted.length > 0}
                      />
                    </div>
                  </div>
                  {slotCounted.length > 0 && <SlotMacros macros={slotTotals} />}
                </div>
                {slotEntries.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {slotEntries.map((e) => (
                      <PlanEntryRow key={e.id} entry={toDayEntry(e)} />
                    ))}
                    {slotCounted.length >= 2 && (
                      <SaveSlotMealButton
                        date={date}
                        slot={slot}
                        slotLabel={SLOT_LABELS[slot]}
                        count={slotCounted.length}
                      />
                    )}
                  </div>
                )}
                <AddFoodControl
                  date={date}
                  slot={slot}
                  slotLabel={SLOT_LABELS[slot]}
                  meals={meals}
                  tags={tags}
                  products={products}
                  productUsage={productUsage}
                  mealUsage={mealUsage}
                  slotCount={saveable ? slotCounted.length : 0}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
