import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { MacroSummary } from "@/components/macro-summary";
import {
  AddMealControl,
  PlanEntryRow,
  type DayEntry,
} from "@/components/day-planner";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { addDaysKey, formatLong, keyToDbDate } from "@/lib/dates";
import {
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

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const userId = await requireUserId();
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const [entries, mealRecords, tags] = await Promise.all([
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
      select: {
        id: true,
        name: true,
        kcal: true,
        tags: { select: { tagId: true } },
      },
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

  const counted = entries.filter((e) => e.status !== "SKIPPED");
  const totals = sumDayEntries(
    counted.map<EntryForMacros>((e) => ({
      servings: e.servings,
      grams: e.grams,
      meal: e.meal ? toMealMacros(e.meal) : null,
      product: e.product ? toMealMacros(e.product) : null,
    })),
  );

  const bySlot = new Map<SlotKey, typeof entries>();
  for (const slot of SLOTS) bySlot.set(slot, []);
  for (const e of entries) bySlot.get(e.slot as SlotKey)?.push(e);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/calendar/${addDaysKey(date, -1)}`}
          className="rounded-lg p-2 hover:bg-muted"
          aria-label="Previous day"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center">
          <p className="font-semibold">{formatLong(date)}</p>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <CalendarDays className="size-3" /> Month view
          </Link>
        </div>
        <Link
          href={`/calendar/${addDaysKey(date, 1)}`}
          className="rounded-lg p-2 hover:bg-muted"
          aria-label="Next day"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <Card className="mb-4">
        <CardContent>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Day total ({counted.length} meal{counted.length === 1 ? "" : "s"})
          </p>
          <MacroSummary macros={totals} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {SLOTS.map((slot) => {
          const slotEntries = bySlot.get(slot) ?? [];
          return (
            <Card key={slot}>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm font-semibold">{SLOT_LABELS[slot]}</p>
                {slotEntries.length > 0 && (
                  <div className="flex flex-col gap-1.5">
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
                <AddMealControl
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
