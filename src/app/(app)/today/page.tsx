import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { AvatarLink } from "@/components/avatar-link";
import { DayCopyMenu } from "@/components/day-copy-menu";
import { TodayView, type SlotPreview } from "@/components/today/today-view";
import { SLOTS, type SlotKey } from "@/lib/schemas";
import { addDaysKey, keyToDbDate } from "@/lib/dates";
import { gramsPerServing } from "@/lib/macros";
import { macrosOf, sumByStatus, type Targets } from "@/lib/macro-format";
import { toDayEntry } from "@/lib/day-entry";
import { loadPickerProducts } from "@/lib/meal-form-products";
import { loadMealUsage, loadProductUsage } from "@/lib/load-usage";
import { remainingMacros, suggestMeals } from "@/lib/suggest";
import { userNow } from "@/lib/user-time";
import { format, parseISO } from "date-fns";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ENTRY_INCLUDE = {
  meal: { select: { name: true, cookedGrams: true, serves: true } },
  product: {
    select: {
      name: true,
      servingGrams: true,
      portions: { select: { label: true, grams: true }, orderBy: { position: "asc" as const } },
    },
  },
};

function dayTitle(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDaysKey(today, -1)) return "Yesterday";
  if (date === addDaysKey(today, 1)) return "Tomorrow";
  return format(parseISO(date), "EEE d MMM");
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; add?: string }>;
}) {
  const userId = await requireUserId();
  const { date: dateParam, add } = await searchParams;
  const now = await userNow();
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : now.today;
  const isToday = date === now.today;
  const focusSlot = SLOTS.includes(add as SlotKey) ? (add as SlotKey) : null;

  const [user, entries, yesterdayEntries, mealRecords, tags, products, productUsage, mealUsage] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
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
        include: ENTRY_INCLUDE,
      }),
      prisma.planEntry.findMany({
        where: { userId, date: keyToDbDate(addDaysKey(date, -1)), status: { not: "SKIPPED" } },
        orderBy: [{ slot: "asc" }, { position: "asc" }],
        include: { meal: { select: { name: true } }, product: { select: { name: true } } },
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

  const targets: Targets = {
    kcal: user?.targetKcal ?? null,
    protein: user?.targetProtein ?? null,
    fat: user?.targetFat ?? null,
    carbs: user?.targetCarbs ?? null,
    sugar: user?.targetSugar ?? null,
    fiber: user?.targetFiber ?? null,
  };

  // "Fits what's left" works from what's eaten *and* planned: a planned dinner
  // already spends its share of the day.
  const totals = sumByStatus(entries);
  const committed = Object.fromEntries(
    Object.keys(totals.eaten).map((k) => [
      k,
      totals.eaten[k as keyof typeof totals.eaten] + totals.planned[k as keyof typeof totals.planned],
    ]),
  ) as typeof totals.eaten;
  const suggestions = suggestMeals(mealRecords, remainingMacros(committed, targets), 5).map((m) => ({
    id: m.id,
    name: m.name,
    kcal: m.kcal,
    protein: m.protein,
  }));

  const yesterday: Partial<Record<SlotKey, SlotPreview>> = {};
  for (const e of yesterdayEntries) {
    const slot = e.slot as SlotKey;
    const p = (yesterday[slot] ??= { names: [], kcal: 0 });
    p.names.push(e.product?.name ?? e.meal?.name ?? e.label ?? "Quick add");
    p.kcal += macrosOf(e).kcal;
  }

  const meals = mealRecords.map((m) => ({
    id: m.id,
    name: m.name,
    kcal: m.kcal,
    tagIds: m.tags.map((t) => t.tagId),
    favorite: m.favorite,
    gramsPerServing: gramsPerServing(m),
  }));

  const navBtn = "grid size-11 shrink-0 place-items-center rounded-[14px] text-ink hover:bg-surface-2";

  return (
    <>
      <header className="mb-4 flex items-center gap-1">
        <Link href={`/today?date=${addDaysKey(date, -1)}`} className={navBtn} aria-label="Previous day">
          <ChevronLeft className="size-6" />
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="t-title leading-none">{dayTitle(date, now.today)}</h1>
          <p className="mt-1 text-[13px] text-ink-2">{format(parseISO(date), "EEE d MMM")}</p>
        </div>
        <Link href={`/today?date=${addDaysKey(date, 1)}`} className={navBtn} aria-label="Next day">
          <ChevronRight className="size-6" />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {entries.length > 0 && <DayCopyMenu date={date} isEmpty={false} />}
          <AvatarLink name={user?.name || user?.email} />
        </div>
      </header>

      {entries.length === 0 && <DayCopyMenu date={date} isEmpty />}

      <TodayView
        key={date}
        date={date}
        logAsEaten={date <= now.today}
        currentSlot={isToday ? now.slot : null}
        focusSlot={focusSlot}
        targets={targets}
        entries={entries.map(toDayEntry)}
        suggestions={suggestions}
        yesterday={yesterday}
        addData={{ meals, tags, products, productUsage, mealUsage }}
      />
    </>
  );
}
