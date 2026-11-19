import { prisma } from "@/lib/prisma";
import { addDaysKey, dbDateToKey, keyToDbDate, type DateKey } from "@/lib/dates";
import { sumByStatus } from "@/lib/macro-format";
import { ZERO_MACROS, type Macros } from "@/lib/macros";

export type ProgressDay = {
  date: DateKey;
  eaten: Macros;
  /** Anything eaten that day. */
  logged: boolean;
  today: boolean;
};

export type WeighIn = { id: string; date: DateKey; kg: number; trend: number };

export type Progress = {
  days: ProgressDay[];
  /** Averages over the logged days before today (today is still going). */
  avg: Macros | null;
  loggedDays: number;
  weighIns: WeighIn[];
  /** The bodyweight window in days (at least 30, so a trend shows). */
  weightWindow: number;
};

/** Eaten macros per day for the last `range` days (ending today), plus bodyweight. */
export async function loadProgress(userId: string, today: DateKey, range: number): Promise<Progress> {
  const start = addDaysKey(today, -(range - 1));
  const weightWindow = Math.max(range, 30);
  const weightStart = addDaysKey(today, -(weightWindow - 1));
  const [entries, weights] = await Promise.all([
    prisma.planEntry.findMany({
      where: { userId, status: "EATEN", date: { gte: keyToDbDate(start), lte: keyToDbDate(today) } },
      select: {
        date: true,
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
      },
    }),
    // A week before the window too, so the first trend point has history.
    prisma.bodyweightLog.findMany({
      where: { userId, recordedAt: { gte: keyToDbDate(addDaysKey(weightStart, -6)), lte: keyToDbDate(today) } },
      orderBy: { recordedAt: "asc" },
      select: { id: true, recordedAt: true, weightKg: true },
    }),
  ]);

  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = dbDateToKey(e.date);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days: ProgressDay[] = Array.from({ length: range }, (_, i) => {
    const date = addDaysKey(start, i);
    const list = byDay.get(date) ?? [];
    return { date, eaten: sumByStatus(list).eaten, logged: list.length > 0, today: date === today };
  });

  const past = days.filter((d) => d.logged && !d.today);
  let avg: Macros | null = null;
  if (past.length > 0) {
    const sum = past.reduce(
      (acc, d) => {
        for (const k of Object.keys(acc) as (keyof Macros)[]) acc[k] += d.eaten[k];
        return acc;
      },
      { ...ZERO_MACROS },
    );
    avg = { ...sum };
    for (const k of Object.keys(avg) as (keyof Macros)[]) avg[k] = sum[k] / past.length;
  }

  // Trend = mean of the weigh-ins in the 7 days up to and including each one.
  const all = weights.map((w) => ({ id: w.id, date: dbDateToKey(w.recordedAt), kg: w.weightKg }));
  const weighIns: WeighIn[] = all
    .filter((w) => w.date >= weightStart)
    .map((w) => {
      const from = addDaysKey(w.date, -6);
      const near = all.filter((x) => x.date >= from && x.date <= w.date);
      return { ...w, trend: near.reduce((s, x) => s + x.kg, 0) / near.length };
    });

  return { days, avg, loggedDays: past.length, weighIns, weightWindow };
}
