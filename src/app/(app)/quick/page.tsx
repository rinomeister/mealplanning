import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { dayHref, parseDate, parseSlot } from "@/lib/add-flow";
import { QuickAddForm } from "@/components/add/quick-add-form";

export default async function QuickAddPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; date?: string }>;
}) {
  await requireUserId();
  const sp = await searchParams;
  const now = await userNow();
  const date = parseDate(sp.date) ?? now.today;
  const slot = parseSlot(sp.slot) ?? now.slot;
  return (
    <QuickAddForm
      date={date}
      initialSlot={slot}
      eatenFlag={date <= now.today}
      backHref={dayHref(date, now.today)}
    />
  );
}
