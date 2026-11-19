import { SLOTS, type SlotKey } from "@/lib/schemas";

export type FlowKind = "scan" | "search" | "meal" | "quick";

const PATHS: Record<FlowKind, string> = {
  scan: "/scan",
  search: "/search",
  meal: "/meals/pick",
  quick: "/quick",
};

/** Full-screen add flows: /scan, /search, /meals/pick, /quick — ?slot=&date=. */
export function flowHref(kind: FlowKind, slot: SlotKey, date?: string | null): string {
  const q = new URLSearchParams({ slot });
  if (date) q.set("date", date);
  return `${PATHS[kind]}?${q}`;
}

/** Paths that are full-screen flows: no tab bar. */
export const FLOW_PATHS = Object.values(PATHS);

/** Full-screen pages: no tab bar (they bring their own top and bottom bars). */
export function isFlowPath(pathname: string): boolean {
  return FLOW_PATHS.includes(pathname) || pathname.startsWith("/products/") || pathname.startsWith("/meals/") || pathname.startsWith("/plan/list/");
}

export function parseSlot(raw: string | undefined | null): SlotKey | null {
  return raw && (SLOTS as readonly string[]).includes(raw) ? (raw as SlotKey) : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(raw: string | undefined | null): string | null {
  return raw && DATE_RE.test(raw) ? raw : null;
}

/** Where a flow goes when it's done: the day it added to. */
export function dayHref(date: string, today: string): string {
  return date === today ? "/today" : `/today?date=${date}`;
}
