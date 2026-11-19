import { requireUserId } from "@/lib/auth-helpers";
import { PlanTabs } from "@/components/plan-tabs";
import { ShoppingListView } from "@/components/plan/shopping-list-view";
import { userNow } from "@/lib/user-time";
import { defaultListRange, loadShoppingList } from "@/lib/shopping-list";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const now = await userNow();
  const def = await defaultListRange(userId, now.today);
  const custom = sp.start && DATE_RE.test(sp.start) && sp.end && DATE_RE.test(sp.end) && sp.end >= sp.start;
  const range = custom ? { start: sp.start!, end: sp.end! } : def;
  const [list, defList] = await Promise.all([
    loadShoppingList(userId, range.start, range.end),
    custom ? loadShoppingList(userId, def.start, def.end) : null,
  ]);

  return (
    <ShoppingListView
      // Fresh state (ticks, counts) whenever the range changes.
      key={`${range.start}|${range.end}`}
      list={list}
      range={range}
      today={now.today}
      custom={!!custom}
      tabs={<PlanTabs active="list" left={(defList ?? list).left} />}
    />
  );
}
