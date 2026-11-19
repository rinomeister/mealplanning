import Link from "next/link";
import { format, parseISO, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { AvatarLink } from "@/components/avatar-link";
import { HomeTodayCard, LogAgain, type NextUp } from "@/components/home/home-today";
import { WeekCard, type WeekDay } from "@/components/home/week-card";
import { addDaysKey, dbDateToKey, formatDayHeading, keyToDbDate } from "@/lib/dates";
import { macrosOf, sumByStatus, type Targets } from "@/lib/macro-format";
import { SLOTS, type SlotKey } from "@/lib/schemas";
import { userNow } from "@/lib/user-time";
import { countLeftToBuy } from "@/lib/shopping-list";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { getAddSheetDataAction } from "@/app/(app)/today/actions";

const MACRO_SELECT = {
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
} as const;

export default async function HomePage() {
  const userId = await requireUserId();
  const now = await userNow();
  const today = now.today;
  const tomorrow = addDaysKey(today, 1);
  const weekStart = format(startOfWeek(parseISO(today), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = addDaysKey(weekStart, 6);

  const [user, todayEntries, weekEntries, tomorrowSlots, weights, sheet, toBuy] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        units: true,
        targetKcal: true,
        targetProtein: true,
        targetFat: true,
        targetCarbs: true,
        targetSugar: true,
        targetFiber: true,
      },
    }),
    prisma.planEntry.findMany({
      where: { userId, date: keyToDbDate(today) },
      orderBy: [{ slot: "asc" }, { position: "asc" }],
      select: {
        ...MACRO_SELECT,
        slot: true,
        label: true,
        meal: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.planEntry.findMany({
      where: { userId, date: { gte: keyToDbDate(weekStart), lte: keyToDbDate(weekEnd) } },
      select: { ...MACRO_SELECT, date: true },
    }),
    prisma.planEntry.findMany({
      where: { userId, date: keyToDbDate(tomorrow), status: { not: "SKIPPED" } },
      select: { slot: true },
      distinct: ["slot"],
    }),
    prisma.bodyweightLog.findMany({
      where: { userId, recordedAt: { gte: keyToDbDate(addDaysKey(today, -30)) } },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true, weightKg: true },
    }),
    getAddSheetDataAction(today, now.slot),
    countLeftToBuy(userId, today),
  ]);

  const targets: Targets = {
    kcal: user.targetKcal,
    protein: user.targetProtein,
    fat: user.targetFat,
    carbs: user.targetCarbs,
    sugar: user.targetSugar,
    fiber: user.targetFiber,
  };
  const totals = sumByStatus(todayEntries);

  // Next: the earliest slot that still has something planned (not eaten yet).
  let next: NextUp | null = null;
  for (const slot of SLOTS) {
    const planned = todayEntries.filter((e) => e.slot === slot && e.status === "PLANNED");
    if (planned.length === 0) continue;
    next = {
      slot,
      names: planned.map((e) => e.product?.name ?? e.meal?.name ?? e.label ?? "Quick add"),
      kcal: planned.reduce((s, e) => s + macrosOf(e).kcal, 0),
    };
    break;
  }

  // This week, Monday to Sunday: eaten kcal and protein per day.
  const byDay = new Map<string, typeof weekEntries>();
  for (const e of weekEntries) {
    const k = dbDateToKey(e.date);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(weekStart, i);
    const { eaten } = sumByStatus(byDay.get(date) ?? []);
    return {
      date,
      letter: format(parseISO(date), "EEEEE"),
      kcal: eaten.kcal,
      protein: eaten.protein,
      sugar: eaten.sugar,
      when: date < today ? "past" : date === today ? "today" : "future",
    };
  });

  const units = user.units as UnitSystem;
  const latest = weights.at(-1);
  const first = weights[0];

  return (
    <>
      <PageHeader
        eyebrow={formatDayHeading(today)}
        title="Home"
        action={<AvatarLink name={user.name || user.email} />}
      />

      <div className="flex flex-col gap-3">
        <HomeTodayCard date={today} slot={now.slot} totals={totals} targets={targets} next={next} />

        {sheet.recents.length > 0 && <LogAgain date={today} slot={now.slot} items={sheet.recents.slice(0, 3)} />}

        <WeekCard days={days} targets={targets} />

        <div className="grid grid-cols-2 gap-3">
          <Link href="/me" className="card press flex min-w-0 flex-col gap-1.5 p-3.5">
            <span className="text-xs font-semibold text-ink-3">Bodyweight</span>
            {latest ? (
              <>
                <span>
                  <span className="num text-2xl font-semibold">{kgToDisplay(latest.weightKg, units).toFixed(1)}</span>
                  <span className="text-sm text-ink-3"> {weightLabel(units)}</span>
                </span>
                <Sparkline values={weights.map((w) => w.weightKg)} />
                {first && weights.length > 1 && (
                  <span className="text-xs text-ink-3">
                    {formatDelta(kgToDisplay(latest.weightKg, units) - kgToDisplay(first.weightKg, units))}{" "}
                    {weightLabel(units)} · {Math.max(1, daysBetween(first.recordedAt, latest.recordedAt))} days
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-ink-2">Log your weight to see the trend.</span>
            )}
          </Link>

          <Link href="/plan" className="card press flex min-w-0 flex-col gap-2 p-3.5">
            <span className="text-xs font-semibold text-ink-3">Plan &amp; list</span>
            <span className="text-sm">
              <b>Tomorrow</b>
              <br />
              <span className="text-ink-3">
                {tomorrowSlots.length} of {SLOTS.length} slots planned
              </span>
            </span>
            <span className="flex gap-[3px]" aria-hidden>
              {SLOTS.map((s) => (
                <i
                  key={s}
                  className="h-1.5 flex-1 rounded-full"
                  style={{
                    background: tomorrowSlots.some((t) => (t.slot as SlotKey) === s) ? "var(--ink)" : "var(--track)",
                  }}
                />
              ))}
            </span>
            <span className="text-sm">
              <b className="num">{toBuy}</b> <span className="text-ink-3">to buy</span>
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}

function formatDelta(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "±0";
  return r > 0 ? `+${r.toFixed(1)}` : `−${Math.abs(r).toFixed(1)}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** A bare trend line for the bodyweight card. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="block h-[30px]" aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = 2 + (i / (values.length - 1)) * 136;
    const y = 4 + (1 - (v - min) / span) * 22;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width="100%" height="30" viewBox="0 0 140 30" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
