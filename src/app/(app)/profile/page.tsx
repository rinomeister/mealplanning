import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { ProfileForm, type ProfileInitial } from "@/components/profile-form";
import { BodyweightPanel, type WeightLog } from "@/components/bodyweight-panel";
import { dbDateToKey, todayKey } from "@/lib/dates";
import type { UnitSystem } from "@/lib/units";

function numToStr(n: number | null): string {
  return n == null ? "" : n.toString();
}

export default async function ProfilePage() {
  const userId = await requireUserId();

  const [user, weights] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.bodyweightLog.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 200,
    }),
  ]);

  const profileInitial: ProfileInitial = {
    name: user.name ?? "",
    heightCm: numToStr(user.heightCm),
    targetKcal: numToStr(user.targetKcal),
    targetProtein: numToStr(user.targetProtein),
    targetFat: numToStr(user.targetFat),
    targetCarbs: numToStr(user.targetCarbs),
    targetSugar: numToStr(user.targetSugar),
    targetFiber: numToStr(user.targetFiber),
    units: user.units as UnitSystem,
  };

  const logs: WeightLog[] = weights.map((w) => ({
    id: w.id,
    recordedAt: dbDateToKey(w.recordedAt),
    weightKg: w.weightKg,
    note: w.note,
  }));

  return (
    <>
      <PageHeader title="Profile" description="Your details, goals, and weight log." />
      <div className="flex flex-col gap-4">
        <ProfileForm initial={profileInitial} />
        <BodyweightPanel
          logs={logs}
          units={user.units as UnitSystem}
          today={todayKey()}
        />
      </div>
    </>
  );
}
