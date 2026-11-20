import Link from "next/link";
import { ChevronRight, Download, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { loadProgress } from "@/lib/progress";
import { MACROS_UI, fmtKcal } from "@/lib/macro-format";
import { PROFILE_FIELDS, pcfKcal } from "@/lib/profile-fields";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { BackButton } from "@/components/back-button";
import { MacroDot } from "@/components/macro-ui";
import { ThemeSetting } from "@/components/theme";
import { ScannerEngineName, UnitsSetting, WelcomeCard } from "@/components/me/me-client";
import { signOutAction } from "../actions";

const row = "flex min-h-[52px] items-center gap-3 px-4";

export default async function MePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const userId = await requireUserId();
  const now = await userNow();
  const [user, progress, latest] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    loadProgress(userId, now.today, 7),
    prisma.bodyweightLog.findFirst({ where: { userId }, orderBy: { recordedAt: "desc" }, select: { weightKg: true } }),
  ]);
  const units = user.units as UnitSystem;

  // Last 6 full days (today is still going).
  const past = progress.days.filter((d) => !d.today);
  const hit = user.targetProtein != null ? past.filter((d) => d.eaten.protein >= user.targetProtein!).length : null;
  const maxP = Math.max(user.targetProtein ?? 0, ...past.map((d) => d.eaten.protein), 1);
  const summary = [
    hit != null && past.some((d) => d.logged) ? `Protein target hit ${hit} of the last ${past.length} days` : "Your week, averages and bodyweight",
    latest ? `${kgToDisplay(latest.weightKg, units).toFixed(1)} ${weightLabel(units)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const t = {
    kcal: user.targetKcal,
    protein: user.targetProtein,
    carbs: user.targetCarbs,
    fat: user.targetFat,
    sugar: user.targetSugar,
    fiber: user.targetFiber,
  };
  const pcf = t.protein != null && t.carbs != null && t.fat != null ? pcfKcal(t.protein, t.carbs, t.fat) : null;
  const pcfPct = pcf != null && t.kcal ? Math.round((Math.abs(pcf - t.kcal) / t.kcal) * 100) : null;

  return (
    <div className="desk:mx-auto desk:max-w-2xl">
      <div className="mb-4 flex items-center gap-1">
        <BackButton fallback="/" />
        <h1 className="t-title">Me</h1>
      </div>

      <div className="flex flex-col gap-3">
        {welcome && <WelcomeCard />}

        <Link href="/me/progress" className="card press flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">Progress</span>
            <span className="block text-sm text-ink-2">{summary}</span>
          </span>
          <span className="flex h-8 items-end gap-[3px]" aria-hidden>
            {past.map((d) => (
              <i
                key={d.date}
                className="block w-[7px] rounded-[2px]"
                style={{
                  height: `${Math.max(8, (d.eaten.protein / maxP) * 100)}%`,
                  background: d.logged ? "var(--pro)" : "var(--track)",
                  opacity: d.logged && user.targetProtein != null && d.eaten.protein < user.targetProtein ? 0.45 : 1,
                }}
              />
            ))}
          </span>
          <ChevronRight className="size-5 shrink-0 text-ink-3" />
        </Link>

        <h2 className="t-cap mt-3">Daily targets</h2>
        <ul className="card divide-y divide-line overflow-hidden">
          <li>
            <Link href="/me/edit/kcal" className={row}>
              <span className="flex-1">Calories</span>
              <Val v={t.kcal != null ? `${fmtKcal(t.kcal)} kcal` : null} />
            </Link>
          </li>
          {MACROS_UI.map((m) => (
            <li key={m.key}>
              <Link href={`/me/edit/${m.key}`} className={row}>
                <MacroDot macro={m.key} />
                <span className="flex-1">{PROFILE_FIELDS[m.key].label}</span>
                <Val v={t[m.key] != null ? `${t[m.key]} g` : null} />
              </Link>
            </li>
          ))}
        </ul>
        {pcf != null && t.kcal != null && (
          <p className="-mt-1 px-1 text-[13px] text-ink-3">
            P/C/F add up to {fmtKcal(pcf)} kcal
            {pcfPct! <= 2
              ? ` · within ${pcfPct}% of your calorie target.`
              : ` · ${fmtKcal(Math.abs(pcf - t.kcal))} kcal ${pcf > t.kcal ? "over" : "under"} your calorie target.`}
          </p>
        )}

        <h2 className="t-cap mt-3">You</h2>
        <ul className="card divide-y divide-line overflow-hidden">
          <li>
            <Link href="/me/edit/name" className={row}>
              <span className="flex-1">Name</span>
              <Val v={user.name} />
            </Link>
          </li>
          <li>
            <Link href="/me/edit/height" className={row}>
              <span className="flex-1">Height</span>
              <Val v={user.heightCm != null ? `${user.heightCm} cm` : null} />
            </Link>
          </li>
          <li>
            <Link href="/me/progress" className={row}>
              <span className="flex-1">Bodyweight</span>
              <Val v={latest ? `${kgToDisplay(latest.weightKg, units).toFixed(1)} ${weightLabel(units)}` : "Log it"} />
            </Link>
          </li>
        </ul>

        <h2 className="t-cap mt-3">App</h2>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0">Units</span>
            <div className="min-w-0 flex-1">
              <UnitsSetting units={units} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0">Theme</span>
            <div className="min-w-0 flex-1">
              <ThemeSetting />
            </div>
          </div>
          <p className="px-1 text-[13px] text-ink-3">Theme applies to this device only.</p>
        </div>
        <ul className="card divide-y divide-line overflow-hidden">
          <li>
            <Link href="/me/scanner" className={row}>
              <span className="flex-1">Scanner engine</span>
              <span className="text-sm text-ink-3">
                <ScannerEngineName />
              </span>
              <ChevronRight className="size-5 text-ink-3" />
            </Link>
          </li>
          <li>
            <Link href="/import" className={row}>
              <Download className="size-5 text-ink-2" />
              <span className="flex-1">Import shared meal</span>
              <ChevronRight className="size-5 text-ink-3" />
            </Link>
          </li>
          <li>
            <form action={signOutAction}>
              <button type="submit" className={`${row} w-full text-left text-bad`}>
                <LogOut className="size-5" />
                <span className="flex-1 font-semibold">Sign out</span>
              </button>
            </form>
          </li>
        </ul>
        <p className="truncate px-1 text-[13px] text-ink-3">Signed in as {user.email}</p>
      </div>
    </div>
  );
}

function Val({ v }: { v: string | null }) {
  return (
    <>
      <span className={v ? "num font-semibold" : "text-ink-3"}>{v ?? "Not set"}</span>
      <ChevronRight className="-mr-1 size-5 shrink-0 text-ink-3" />
    </>
  );
}
