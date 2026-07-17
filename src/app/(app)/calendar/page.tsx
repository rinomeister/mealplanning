import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { PlanTabs } from "@/components/plan-tabs";
import {
  WEEKDAY_LABELS,
  dbDateToKey,
  formatMonthTitle,
  getMonthGrid,
  keyToDbDate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

function parseMonth(m: string | undefined): { year: number; month0: number } {
  const now = new Date();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y, month0: mo - 1 };
  }
  return { year: now.getFullYear(), month0: now.getMonth() };
}

function monthParam(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const userId = await requireUserId();
  const { m } = await searchParams;
  const { year, month0 } = parseMonth(m);

  const cells = getMonthGrid(year, month0);
  const first = cells[0].key;
  const last = cells[cells.length - 1].key;

  const entries = await prisma.planEntry.findMany({
    where: {
      userId,
      date: { gte: keyToDbDate(first), lte: keyToDbDate(last) },
    },
    select: { date: true, status: true },
  });

  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.status === "SKIPPED") continue;
    const key = dbDateToKey(e.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const prev = month0 === 0 ? { year: year - 1, month0: 11 } : { year, month0: month0 - 1 };
  const next = month0 === 11 ? { year: year + 1, month0: 0 } : { year, month0: month0 + 1 };

  return (
    <>
      <PageHeader title="Plan" description="Plan your meals by day." />
      <PlanTabs active="calendar" />

      <div className="mb-3 flex items-center justify-between">
        <Link
          href={`/calendar?m=${monthParam(prev.year, prev.month0)}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted active:bg-muted"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-6" />
        </Link>
        <p className="text-lg font-semibold">{formatMonthTitle(year, month0)}</p>
        <Link
          href={`/calendar?m=${monthParam(next.year, next.month0)}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted active:bg-muted"
          aria-label="Next month"
        >
          <ChevronRight className="size-6" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = counts.get(cell.key) ?? 0;
          return (
            <Link
              key={cell.key}
              href={`/calendar/${cell.key}`}
              className={cn(
                "flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-sm transition-colors",
                cell.inMonth
                  ? "border-border hover:border-primary/50"
                  : "border-transparent text-muted-foreground/50",
                cell.isToday && "border-primary bg-primary/5 font-semibold",
              )}
            >
              <span>{cell.day}</span>
              {count > 0 && (
                <span className="mt-auto flex items-center gap-0.5">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <span className="text-[11px] text-muted-foreground">{count}</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
