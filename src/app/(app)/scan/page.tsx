import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { dayHref, parseDate, parseSlot } from "@/lib/add-flow";
import { loadProductUsage } from "@/lib/load-usage";
import { loadDayContext } from "@/lib/load-day";
import { ScannerScreen } from "@/components/add/scanner-screen";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; date?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const now = await userNow();
  const date = parseDate(sp.date) ?? now.today;
  const slot = parseSlot(sp.slot) ?? now.slot;

  const [usage, day] = await Promise.all([loadProductUsage(userId), loadDayContext(userId, date)]);
  const lastGrams = Object.fromEntries(Object.entries(usage.last).map(([id, l]) => [id, l.grams]));

  return (
    <ScannerScreen
      date={date}
      initialSlot={slot}
      eatenFlag={date <= now.today}
      backHref={dayHref(date, now.today)}
      lastGrams={lastGrams}
      favoriteIds={usage.favoriteIds}
      eaten={day.totals.eaten}
      targets={day.targets}
    />
  );
}
