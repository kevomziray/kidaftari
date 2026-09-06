import { APP_TIME_ZONE, CURRENCY } from "@/lib/constants";

export function formatTzs(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function dateInputValue(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function phoneForDisplay(phone: string) {
  if (phone.startsWith("+255") && phone.length === 13) {
    return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
  }
  return phone;
}
