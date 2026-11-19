import type { SlotKey } from "@/lib/schemas";

/**
 * The slot "+" and the scanner log into by default, from local time:
 * before 10 Breakfast · 10–12 Snack 1 · 12–15 Lunch · 15–18 Snack 2 · after
 * 18 Dinner. Call it in the browser so it uses the phone's clock, not the
 * server's.
 */
export function defaultSlot(now: Date = new Date()): SlotKey {
  const h = now.getHours();
  if (h < 10) return "BREAKFAST";
  if (h < 12) return "SNACK_1";
  if (h < 15) return "LUNCH";
  if (h < 18) return "SNACK_2";
  return "DINNER";
}
