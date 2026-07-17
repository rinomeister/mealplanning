import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { PlanTabs } from "@/components/plan-tabs";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShoppingItemRow } from "@/components/shopping-item-row";
import { clearCheckedAction } from "./actions";
import {
  addDaysKey,
  formatHuman,
  keyToDbDate,
  todayKey,
} from "@/lib/dates";
import { aggregateIngredients, formatShoppingAmount } from "@/lib/shopping";
import Link from "next/link";
import { cn } from "@/lib/utils";

const RANGES = {
  day: { label: "Day", days: 1 },
  week: { label: "Week", days: 7 },
  "2weeks": { label: "2 weeks", days: 14 },
  month: { label: "Month", days: 30 },
} as const;

type RangeKey = keyof typeof RANGES;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;

  const range: RangeKey =
    sp.range && sp.range in RANGES ? (sp.range as RangeKey) : "week";
  const start = sp.start && DATE_RE.test(sp.start) ? sp.start : todayKey();
  const end = addDaysKey(start, RANGES[range].days - 1);

  const entries = await prisma.planEntry.findMany({
    where: {
      userId,
      status: "PLANNED",
      // Only meal entries carry ingredients; scanned products don't.
      mealId: { not: null },
      date: { gte: keyToDbDate(start), lte: keyToDbDate(end) },
    },
    select: {
      servings: true,
      meal: {
        select: {
          ingredients: { select: { name: true, qty: true, unit: true } },
        },
      },
    },
  });

  const mealEntries = entries.filter(
    (e): e is typeof e & { meal: NonNullable<typeof e.meal> } => e.meal !== null,
  );
  const items = aggregateIngredients(mealEntries);

  const checks = await prisma.shoppingCheck.findMany({
    where: { userId, itemKey: { in: items.map((i) => i.key) } },
    select: { itemKey: true },
  });
  const checkedSet = new Set(checks.map((c) => c.itemKey));

  const checkedCount = items.filter((i) => checkedSet.has(i.key)).length;

  return (
    <>
      <PageHeader
        title="Plan"
        description="Your shopping list, built from planned (not-yet-eaten) meals."
      />
      <PlanTabs active="shopping" />

      {/* Range chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(RANGES) as RangeKey[]).map((r) => (
          <Link
            key={r}
            href={`/shopping?range=${r}&start=${start}`}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              r === range
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {RANGES[r].label}
          </Link>
        ))}
      </div>

      {/* Start date */}
      <form action="/shopping" className="mb-4 flex items-end gap-2">
        <input type="hidden" name="range" value={range} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="start">
            From
          </label>
          <Input
            id="start"
            type="date"
            name="start"
            defaultValue={start}
            className="w-44"
          />
        </div>
        <Button type="submit" variant="outline">
          Update
        </Button>
      </form>

      <p className="mb-3 text-sm text-muted-foreground">
        {formatHuman(start)} → {formatHuman(end)} · {items.length} item
        {items.length === 1 ? "" : "s"}
      </p>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing to buy"
          description="No planned meals in this range, or their meals have no ingredients."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <ShoppingItemRow
                key={item.key}
                itemKey={item.key}
                name={item.name}
                amount={formatShoppingAmount(item)}
                initialChecked={checkedSet.has(item.key)}
              />
            ))}
          </div>

          {checkedCount > 0 && (
            <form action={clearCheckedAction} className="mt-4">
              <Button type="submit" variant="outline" size="sm">
                Clear {checkedCount} checked
              </Button>
            </form>
          )}
        </>
      )}
    </>
  );
}
