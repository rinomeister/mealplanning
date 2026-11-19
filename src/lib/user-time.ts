import { cookies } from "next/headers";
import type { DateKey } from "@/lib/dates";
import type { SlotKey } from "@/lib/schemas";
import { defaultSlot } from "@/lib/default-slot";

/**
 * The user's local time, from the `tz` cookie the app sets (falls back to the
 * server clock). Lets server-rendered pages know "today" and the current slot.
 */
export async function userNow(): Promise<{ today: DateKey; slot: SlotKey }> {
  const jar = await cookies();
  const raw = jar.get("tz")?.value;
  const now = new Date();
  let tz: string | undefined;
  try {
    tz = raw ? decodeURIComponent(raw) : undefined;
    if (tz) new Intl.DateTimeFormat("en-US", { timeZone: tz }); // validate
  } catch {
    tz = undefined;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour"));
  const local = new Date(now);
  local.setHours(hour);
  return {
    today: `${get("year")}-${get("month")}-${get("day")}`,
    slot: defaultSlot(local),
  };
}
