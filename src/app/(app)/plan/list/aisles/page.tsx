import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { defaultListRange, loadShoppingList } from "@/lib/shopping-list";
import { EditAisles } from "@/components/plan/edit-aisles";

export default async function AislesPage() {
  const userId = await requireUserId();
  const now = await userNow();
  const range = await defaultListRange(userId, now.today);
  const list = await loadShoppingList(userId, range.start, range.end);
  const counts = Object.fromEntries(list.groups.map((g) => [g.aisle.key, g.items.length]));
  return <EditAisles aisles={list.aisles.filter((a) => a.key !== "other")} counts={counts} />;
}
