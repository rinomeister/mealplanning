import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

// We use "yyyy-MM-dd" string keys everywhere in the app and only convert to a
// Date at the Prisma boundary (the `date` columns are @db.Date).

export type DateKey = string;

export function todayKey(): DateKey {
  return format(new Date(), "yyyy-MM-dd");
}

/** Convert a date key to a UTC-midnight Date for storing in a @db.Date column. */
export function keyToDbDate(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Convert a Date returned from a @db.Date column back to a key. */
export function dbDateToKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return format(addDays(parseISO(key), days), "yyyy-MM-dd");
}

/** Inclusive list of keys from start to end. */
export function rangeKeys(startKey: DateKey, endKey: DateKey): DateKey[] {
  return eachDayOfInterval({
    start: parseISO(startKey),
    end: parseISO(endKey),
  }).map((d) => format(d, "yyyy-MM-dd"));
}

export function formatHuman(key: DateKey): string {
  return format(parseISO(key), "EEE, MMM d");
}

export function formatLong(key: DateKey): string {
  return format(parseISO(key), "EEEE, MMMM d, yyyy");
}

export function formatMonthTitle(year: number, month0: number): string {
  return format(new Date(year, month0, 1), "MMMM yyyy");
}

export type CalendarCell = {
  key: DateKey;
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

/** A 6x7-ish grid (whole weeks) covering the given month. Week starts Monday. */
export function getMonthGrid(year: number, month0: number): CalendarCell[] {
  const monthStart = startOfMonth(new Date(year, month0, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const today = todayKey();

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return {
      key,
      day: d.getDate(),
      inMonth: d.getMonth() === month0,
      isToday: key === today,
    };
  });
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
