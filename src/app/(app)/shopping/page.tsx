import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { PlanTabs } from "@/components/plan-tabs";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AtHomeItemRow, ShoppingItemRow } from "@/components/shopping-item-row";
import { clearCheckedAction } from "./actions";
import {
  addDaysKey,
  formatHuman,
  keyToDbDate,
  todayKey,
} from "@/lib/dates";
import {
  aggregateIngredients,
  formatShoppingAmount,
  type ShoppingItem,
} from "@/lib/shopping";
import {
  AISLES,
  AISLE_LABELS,
  aisleKey,
  guessAisle,
  isAisle,
  type Aisle,
} from "@/lib/aisles";
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
  searchParams: Promise<{ range?: string; start?: string; sort?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;

  const range: RangeKey =
    sp.range && sp.range in RANGES ? (sp.range as RangeKey) : "week";
  const start = sp.start && DATE_RE.test(sp.start) ? sp.start : todayKey();
  const end = addDaysKey(start, RANGES[range].days - 1);
  const byAisle = sp.sort !== "az";

  const entries = await prisma.planEntry.findMany({
    where: {
      userId,
      status: "PLANNED",
      // Meals bring their ingredients; planned products are bought as-is.
      OR: [{ mealId: { not: null } }, { productId: { not: null } }],
      date: { gte: keyToDbDate(start), lte: keyToDbDate(end) },
    },
    select: {
      servings: true,
      grams: true,
      meal: {
        select: {
          ingredients: { select: { name: true, qty: true, unit: true } },
        },
      },
      product: { select: { name: true } },
    },
  });

  // A planned product reads like a one-ingredient meal: "200 g skyr".
  const shoppable = entries.flatMap((e) => {
    if (e.meal) return [{ servings: e.servings, meal: e.meal }];
    if (e.product) {
      return [
        {
          servings: 1,
          meal: { ingredients: [{ name: e.product.name, qty: e.grams, unit: "g" }] },
        },
      ];
    }
    return [];
  });
  const items = aggregateIngredients(shoppable);

  const [checks, aisleRows] = await Promise.all([
    prisma.shoppingCheck.findMany({
      where: { userId, itemKey: { in: items.map((i) => i.key) } },
      select: { itemKey: true, checked: true, atHome: true },
    }),
    prisma.shoppingAisle.findMany({
      where: { userId, name: { in: [...new Set(items.map((i) => aisleKey(i.name)))] } },
      select: { name: true, aisle: true },
    }),
  ]);
  const checkedSet = new Set(checks.filter((c) => c.checked).map((c) => c.itemKey));
  const homeSet = new Set(checks.filter((c) => c.atHome).map((c) => c.itemKey));
  const aisleOverride = new Map(aisleRows.map((r) => [r.name, r.aisle]));
  const aisleOf = (item: ShoppingItem): Aisle => {
    const chosen = aisleOverride.get(aisleKey(item.name));
    return chosen && isAisle(chosen) ? chosen : guessAisle(item.name);
  };

  const toBuy = items.filter((i) => !homeSet.has(i.key));
  const atHome = items.filter((i) => homeSet.has(i.key));
  const checkedCount = toBuy.filter((i) => checkedSet.has(i.key)).length;

  const groups: { aisle: Aisle | null; items: ShoppingItem[] }[] = byAisle
    ? AISLES.map((aisle) => ({
        aisle,
        items: toBuy.filter((i) => aisleOf(i) === aisle),
      })).filter((g) => g.items.length > 0)
    : [{ aisle: null, items: toBuy }];
  const qs = (patch: Record<string, string>) =>
    new URLSearchParams({
      range,
      start,
      ...(byAisle ? {} : { sort: "az" }),
      ...patch,
    }).toString();

  return (
    <>
      <PageHeader
        title="Plan"
        description="Your shopping list, built from planned (not-yet-eaten) meals and products."
      />
      <PlanTabs active="shopping" />

      {/* Range chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(RANGES) as RangeKey[]).map((r) => (
          <Link
            key={r}
            href={`/shopping?${qs({ range: r })}`}
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
        {!byAisle && <input type="hidden" name="sort" value="az" />}
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

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {formatHuman(start)} → {formatHuman(end)} · {toBuy.length} item
          {toBuy.length === 1 ? "" : "s"}
        </p>
        {items.length > 0 && (
          <div className="flex shrink-0 rounded-lg border border-border p-0.5 text-xs font-medium">
            {[
              { label: "Aisles", on: byAisle, href: `/shopping?${qs({ sort: "aisle" })}` },
              { label: "A–Z", on: !byAisle, href: `/shopping?${qs({ sort: "az" })}` },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                replace
                className={cn(
                  "inline-flex min-h-8 items-center rounded-md px-2.5",
                  t.on ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing to buy"
          description="No planned meals or products in this range, or their meals have no ingredients."
        />
      ) : (
        <>
          {toBuy.length === 0 && (
            <p className="mb-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              You have everything at home.
            </p>
          )}
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <section key={g.aisle ?? "all"} className="flex flex-col gap-2">
                {g.aisle && (
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {AISLE_LABELS[g.aisle]}
                  </h2>
                )}
                {g.items.map((item) => (
                  <ShoppingItemRow
                    key={item.key}
                    itemKey={item.key}
                    name={item.name}
                    amount={formatShoppingAmount(item)}
                    aisle={aisleOf(item)}
                    initialChecked={checkedSet.has(item.key)}
                  />
                ))}
              </section>
            ))}
          </div>

          {checkedCount > 0 && (
            <form action={clearCheckedAction} className="mt-4">
              <Button type="submit" variant="outline" size="sm">
                Clear {checkedCount} checked
              </Button>
            </form>
          )}

          {atHome.length > 0 && (
            <details className="group mt-6">
              <summary className="flex min-h-10 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-2 text-sm font-medium text-muted-foreground">
                <span className="transition-transform group-open:rotate-90">›</span>
                Already at home ({atHome.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {atHome.map((item) => (
                  <AtHomeItemRow
                    key={item.key}
                    itemKey={item.key}
                    name={item.name}
                    amount={formatShoppingAmount(item)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}
