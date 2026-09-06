export const APP_NAME = "KIDAFTARI";
export const APP_TIME_ZONE = "Africa/Dar_es_Salaam";
export const CURRENCY = "TZS";

export const MAX_TZS_AMOUNT = 2_000_000_000;
export const DEFAULT_REMINDER_DAYS_BEFORE = 3;
export const DEFAULT_REMINDER_HOUR = 9;

export const ROLES = ["OWNER", "STAFF"] as const;
export type AppRole = (typeof ROLES)[number];

export const CUSTOMER_STATUSES = [
  "PAID",
  "ACTIVE_CREDIT",
  "DUE_SOON",
  "DUE_TODAY",
  "OVERDUE",
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
