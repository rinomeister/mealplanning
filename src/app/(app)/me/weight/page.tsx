import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { addDaysKey, dbDateToKey, keyToDbDate } from "@/lib/dates";
import type { UnitSystem } from "@/lib/units";
import { LogWeight } from "@/components/me/log-weight";

/** Only local paths, so ?from= can't send anyone off-site. */
function safeFrom(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/me/progress";
}

export default async function LogWeightPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const userId = await requireUserId();
  const now = await userNow();
  const [user, recent] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { units: true } }),
    prisma.bodyweightLog.findMany({
      where: { userId, recordedAt: { gte: keyToDbDate(addDaysKey(now.today, -6)) } },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, weightKg: true },
    }),
  ]);
  const latest =
    recent[0] ??
    (await prisma.bodyweightLog.findFirst({ where: { userId }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true, weightKg: true } }));
  const trendKg = recent.length > 1 ? recent.reduce((s, w) => s + w.weightKg, 0) / recent.length : null;
  return (
    <LogWeight
      today={now.today}
      units={user.units as UnitSystem}
      last={latest ? { date: dbDateToKey(latest.recordedAt), kg: latest.weightKg } : null}
      trendKg={trendKg}
      from={safeFrom(from)}
    />
  );
}
