import { APP_TIME_ZONE } from "@/lib/constants";

/** Date-only fields are stored at noon UTC so they cannot move to an adjacent day in Tanzania. */
export function dateFromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid date");
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function dateKeyInTanzania(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayInTanzania() {
  return dateFromInput(dateKeyInTanzania(new Date()));
}

export function dateAtTanzaniaHour(date: Date, hour: number) {
  // Tanzania is UTC+3 year-round (no DST).
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - 3, 0, 0),
  );
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
