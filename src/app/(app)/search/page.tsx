import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { dayHref, parseDate, parseSlot } from "@/lib/add-flow";
import { loadProductUsage } from "@/lib/load-usage";
import { loadPickerProducts } from "@/lib/meal-form-products";
import { loadDayContext } from "@/lib/load-day";
import { ProductSearch } from "@/components/add/product-search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; date?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const now = await userNow();
  const date = parseDate(sp.date) ?? now.today;
  const slot = parseSlot(sp.slot) ?? now.slot;

  const [products, usage, day] = await Promise.all([
    loadPickerProducts(),
    loadProductUsage(userId),
    loadDayContext(userId, date),
  ]);

  return (
    <ProductSearch
      date={date}
      initialSlot={slot}
      eatenFlag={date <= now.today}
      backHref={dayHref(date, now.today)}
      products={products}
      usage={usage}
      eaten={day.totals.eaten}
      targets={day.targets}
    />
  );
}
