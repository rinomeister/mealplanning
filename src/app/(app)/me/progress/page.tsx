import Link from "next/link";
import { BarChart3, Scale } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { loadTargets } from "@/lib/load-day";
import { loadProgress } from "@/lib/progress";
import { addDaysKey, dbDateToKey } from "@/lib/dates";
import { fmtG } from "@/lib/macro-format";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/back-button";
import { AveragesList, ProteinChart, WeightChart } from "@/components/me/progress-charts";
import { WeighIns } from "@/components/me/weigh-ins";

const RANGES = [7, 30, 90] as const;

function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "±0";
  return r > 0 ? `+${r.toFixed(1)}` : `−${Math.abs(r).toFixed(1)}`;
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const range = RANGES.find((x) => String(x) === r) ?? 7;
  const userId = await requireUserId();
  const now = await userNow();
  const [user, targets, progress, history] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { units: true } }),
    loadTargets(userId),
    loadProgress(userId, now.today, range),
    prisma.bodyweightLog.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 120,
      select: { id: true, recordedAt: true, weightKg: true },
    }),
  ]);
  const units = user.units as UnitSystem;
  const { days, avg, loggedDays, weighIns, weightWindow } = progress;
  const proteinAvg = avg?.protein ?? null;
  const last = weighIns.at(-1);
  const first = weighIns[0];

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <BackButton fallback="/me" />
        <h1 className="t-title flex-1">Progress</h1>
        <nav className="seg" aria-label="Range">
          {RANGES.map((x) => (
            <Link key={x} href={`/me/progress?r=${x}`} replace scroll={false} aria-current={x === range ? "page" : undefined} className={cn(x === range && "on")}>
              {x} d
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        <section className="card p-4" aria-labelledby="protein-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="protein-heading" className="text-[17px] font-semibold">
              Protein per day
            </h2>
            {proteinAvg != null && (
              <span className="text-sm text-ink-3">
                <b className="num text-[17px] font-semibold text-ink">{fmtG(proteinAvg)}</b> avg
                {targets.protein != null && ` / ${targets.protein} g`}
              </span>
            )}
          </div>
          {loggedDays === 0 && !days.some((d) => d.logged) ? (
            <Empty icon={<BarChart3 className="size-5" />} text="Log a few days and your protein shows up here, day by day." />
          ) : (
            <>
              <ProteinChart days={days} target={targets.protein} />
              <p className="mt-3 text-[13px] text-ink-3">
                Solid = hit · faded = missed · hatched = today so far.{targets.protein != null && " Target line dashed."}
              </p>
            </>
          )}
        </section>

        <section className="card p-4" aria-labelledby="avg-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="avg-heading" className="text-[17px] font-semibold">
              {range}-day averages
            </h2>
            <span className="text-sm text-ink-3">{avg ? `${loggedDays} logged day${loggedDays === 1 ? "" : "s"} · vs target` : "vs target"}</span>
          </div>
          {avg ? (
            <AveragesList avg={avg} targets={targets} />
          ) : (
            <p className="text-sm text-ink-3">Averages start after your first full logged day.</p>
          )}
        </section>

        <section className="card p-4" aria-labelledby="bw-heading">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="bw-heading" className="text-[17px] font-semibold">
              Bodyweight
            </h2>
            {last && (
              <span className="flex items-center gap-2">
                <span>
                  <b className="num text-[26px] font-semibold">{kgToDisplay(last.kg, units).toFixed(1)}</b>{" "}
                  <span className="text-sm text-ink-3">{weightLabel(units)}</span>
                </span>
                {first && first !== last && (
                  <span className="tag bg-surface-2 text-ink">
                    {signed(kgToDisplay(last.trend, units) - kgToDisplay(first.trend, units))} / {weightWindow} d
                  </span>
                )}
              </span>
            )}
          </div>
          {weighIns.length > 0 ? (
            <WeightChart weighIns={weighIns} start={addDaysKey(now.today, -(weightWindow - 1))} end={now.today} units={units} />
          ) : (
            <Empty icon={<Scale className="size-5" />} text={`No weigh-ins in the last ${weightWindow} days.`} />
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-3">{weighIns.length > 0 ? "Dots = weigh-ins · line = 7-day trend" : "Weigh in a few times a week for a steady trend."}</p>
            <Link href={`/me/weight?from=${encodeURIComponent(`/me/progress?r=${range}`)}`} className="press flex h-11 shrink-0 items-center rounded-btn bg-surface-2 px-4 font-semibold">
              Log weight
            </Link>
          </div>
        </section>

        <WeighIns rows={history.map((h) => ({ id: h.id, date: dbDateToKey(h.recordedAt), kg: h.weightKg }))} units={units} />
      </div>
    </>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="grid size-11 place-items-center rounded-[14px] bg-surface-2 text-ink-2">{icon}</span>
      <p className="max-w-xs text-sm text-ink-3">{text}</p>
    </div>
  );
}
