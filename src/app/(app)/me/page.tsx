import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeSetting } from "@/components/theme";
import { signOutAction } from "../actions";
import { ProfileForm, type ProfileInitial } from "@/components/profile-form";
import { ScannerSettings } from "@/components/scanner-settings";
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
      <PageHeader title="Me & settings" />
      <div className="flex flex-col gap-4">
        <ProfileForm initial={profileInitial} />
        <BodyweightPanel
          logs={logs}
          units={user.units as UnitSystem}
          today={todayKey()}
        />
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Applies to this device only.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ThemeSetting />
          </CardContent>
        </Card>
        <ScannerSettings />
        <form action={signOutAction}>
          <p className="mb-2 truncate text-sm text-ink-3">Signed in as {user.email}</p>
          <Button type="submit" variant="outline" className="w-full">
            <LogOut /> Sign out
          </Button>
        </form>
      </div>
    </>
  );
}
