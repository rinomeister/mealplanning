import Link from "next/link";
import { differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PlanTabs } from "@/components/plan-tabs";
import { MacroBar } from "@/components/macro-ui";
import { PlanAddButton, PlanEmptyWeek, PlanMenu } from "@/components/plan/plan-week-client";
import { addDaysKey, dbDateToKey, keyToDbDate } from "@/lib/dates";
import { fmtG, fmtKcal, macrosOf, sumByStatus } from "@/lib/macro-format";
import { loadTargets } from "@/lib/load-day";
import { userNow } from "@/lib/user-time";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { defaultListRange, loadShoppingList } from "@/lib/shopping-list";
import { cn } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const R = 11;
const C = 2 * Math.PI * R;

function rangeLabel(start: string, end: string): string {
  const a = parseISO(start);
  const b = parseISO(end);
  if (start === end) return format(a, "EEE d");
  // Within the next 6 days weekday names are unambiguous; past that, add dates.
  if (differenceInCalendarDays(b, a) < 7) return `${format(a, "EEE")}–${format(b, "EEE")}`;
  return `${format(a, "EEE d")} – ${format(b, "EEE d")}`;
}

export default async function PlanWeekPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const userId = await requireUserId();
  const { date: dateParam } = await searchParams;
  const now = await userNow();
  const selected = dateParam && DATE_RE.test(dateParam) ? dateParam : now.today;
  const weekStart = format(startOfWeek(parseISO(selected), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = addDaysKey(weekStart, 6);

  const [entries, targets, range] = await Promise.all([
    prisma.planEntry.findMany({
      where: { userId, date: { gte: keyToDbDate(weekStart), lte: keyToDbDate(weekEnd) }, status: { not: "SKIPPED" } },
      orderBy: [{ slot: "asc" }, { position: "asc" }],
      select: {
        date: true,
        slot: true,
        status: true,
        servings: true,
        grams: true,
        productId: true,
        label: true,
        kcal: true,
        protein: true,
        fat: true,
        carbs: true,
        sugar: true,
        fiber: true,
        meal: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    loadTargets(userId),
    defaultListRange(userId, now.today),
  ]);
  const [list, lastWeekCount, latestBefore] = await Promise.all([
    loadShoppingList(userId, range.start, range.end),
    entries.length === 0
      ? prisma.planEntry.count({
          where: { userId, date: { gte: keyToDbDate(addDaysKey(weekStart, -7)), lte: keyToDbDate(addDaysKey(weekStart, -1)) }, status: { not: "SKIPPED" } },
        })
      : 0,
    entries.length === 0
      ? prisma.planEntry.findFirst({
          where: { userId, date: { lt: keyToDbDate(weekStart) }, status: { not: "SKIPPED" } },
          orderBy: { date: "desc" },
          select: { date: true },
        })
      : null,
  ]);

  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = dbDateToKey(e.date);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(weekStart, i);
    const t = sumByStatus(byDay.get(date) ?? []);
    return { date, kcal: t.eaten.kcal + t.planned.kcal, has: (byDay.get(date) ?? []).length > 0 };
  });

  const dayEntries = byDay.get(selected) ?? [];
  const totals = sumByStatus(dayEntries);
  const dayKcal = totals.eaten.kcal + totals.planned.kcal;
  const dayProtein = totals.eaten.protein + totals.planned.protein;
  const nav = "grid size-11 place-items-center rounded-[14px] hover:bg-surface-2";

  return (
    <>
      <header className="mb-4 flex items-center gap-1">
        <h1 className="t-title flex-1">Plan</h1>
        <Link href={`/plan?date=${addDaysKey(selected, -7)}`} className={nav} aria-label="Previous week">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="num min-w-[92px] text-center text-[15px] font-semibold">
          {format(parseISO(weekStart), "d")}–{format(parseISO(weekEnd), "d MMM")}
        </span>
        <Link href={`/plan?date=${addDaysKey(selected, 7)}`} className={nav} aria-label="Next week">
          <ChevronRight className="size-5" />
        </Link>
        <PlanMenu date={selected} today={now.today} weekStart={weekStart} />
      </header>

      <PlanTabs active="week" left={list.left} />

      {entries.length === 0 ? (
        <PlanEmptyWeek
          weekStart={weekStart}
          today={now.today}
          lastWeekHas={lastWeekCount > 0}
          sourceDate={latestBefore ? dbDateToKey(latestBefore.date) : null}
        />
      ) : (
        <>

      <nav className="mb-4 grid grid-cols-7 gap-1" aria-label="Days">
        {days.map((d) => {
          const on = d.date === selected;
          const frac = targets.kcal ? Math.min(1, d.kcal / targets.kcal) : d.has ? 1 : 0;
          const over = targets.kcal != null && d.kcal > targets.kcal * 1.05;
          return (
            <Link
              key={d.date}
              href={`/plan?date=${d.date}`}
              replace
              scroll={false}
              aria-current={on ? "date" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[14px] py-2",
                on && "bg-surface shadow-[var(--shadow-card)]",
              )}
            >
              <span className={cn("text-xs", on ? "font-semibold" : "text-ink-3")}>{format(parseISO(d.date), "EEE")}</span>
              <span className={cn("num text-[15px] font-semibold", d.date === now.today && "underline underline-offset-4")}>
                {format(parseISO(d.date), "d")}
              </span>
              <svg width="28" height="28" viewBox="0 0 30 30" className="-rotate-90" aria-hidden>
                <circle cx="15" cy="15" r={R} fill="none" stroke="var(--track)" strokeWidth="4" strokeDasharray={d.has ? undefined : "2 3"} />
                {frac > 0 && (
                  <circle
                    cx="15"
                    cy="15"
                    r={R}
                    fill="none"
                    stroke={over ? "var(--bad)" : "var(--kcal)"}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${C * frac} ${C}`}
                  />
                )}
              </svg>
            </Link>
          );
        })}
      </nav>

      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="t-h2">{format(parseISO(selected), "EEE d")}</h2>
        <p className="num text-sm text-ink-2">
          <b className="text-ink">{fmtKcal(dayKcal)}</b>
          {targets.kcal != null && ` / ${fmtKcal(targets.kcal)}`} · {fmtG(dayProtein)}
          {targets.protein != null && ` / ${fmtG(targets.protein)}`} P
        </p>
      </div>
      <MacroBar
        macro="protein"
        eaten={totals.eaten.protein}
        planned={totals.planned.protein}
        target={targets.protein}
        className="mb-4"
      />

      <section className="card mb-3 px-4" aria-label={`Slots for ${format(parseISO(selected), "EEEE d MMMM")}`}>
        <ul className="divide-y divide-line">
          {SLOTS.map((slot) => {
            const items = dayEntries.filter((e) => e.slot === (slot as SlotKey));
            const kcal = items.reduce((s, e) => s + macrosOf(e).kcal, 0);
            const protein = items.reduce((s, e) => s + macrosOf(e).protein, 0);
            return (
              <li key={slot} className="flex min-h-16 items-center gap-3">
                <span className="w-[72px] shrink-0 text-sm text-ink-3">{SLOT_LABELS[slot]}</span>
                {items.length > 0 ? (
                  <>
                    <Link href={`/today?date=${selected}`} className="min-w-0 flex-1 py-2.5">
                      <span className="block truncate font-semibold">
                        {items.map((e) => e.meal?.name ?? e.product?.name ?? e.label ?? "Quick add").join(" + ")}
                      </span>
                      <span className="num block text-[13px] text-ink-3">
                        {fmtKcal(kcal)} · {fmtG(protein)} P
                        {items.every((e) => e.status === "EATEN") && " · eaten"}
                      </span>
                    </Link>
                    <PlanAddButton slot={slot} label={`Add to ${SLOT_LABELS[slot]}`} />
                  </>
                ) : (
                  <PlanAddButton slot={slot} label="Add or copy from another day" wide />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Link href="/plan/list" className="card press flex min-h-16 items-center gap-3 px-4 py-3">
        <ListChecks className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">
            {list.left > 0 ? (
              <>
                <b>{list.left} to buy</b> for {rangeLabel(range.start, range.end)}
              </>
            ) : (
              <b>Nothing left to buy</b>
            )}
          </span>
          <span className="block text-[13px] text-ink-3">Updates as you plan</span>
        </span>
        <span className="font-semibold">List</span>
        <ChevronRight className="size-5" />
      </Link>
        </>
      )}
    </>
  );
}
