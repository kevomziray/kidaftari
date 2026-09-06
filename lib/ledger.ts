import { addDays, dateKeyInTanzania, todayInTanzania } from "@/lib/dates";
import type { CustomerStatus } from "@/lib/constants";

/** Minimal view used to derive a customer status from canonical credit records. */
export type LedgerStatusEntry = {
  type: "CREDIT" | "PAYMENT";
  amountTzs: number;
  dueDate?: Date | null;
  reversal?: unknown | null;
};

export function customerStatus(
  balanceTzs: number,
  entries: LedgerStatusEntry[],
  dueSoonDays = 3,
): CustomerStatus {
  if (balanceTzs <= 0) return "PAID";

  const openCreditDates = entries
    .filter((entry) => entry.type === "CREDIT" && entry.dueDate && !entry.reversal)
    .map((entry) => entry.dueDate as Date)
    .sort((left, right) => left.getTime() - right.getTime());
  const firstDueDate = openCreditDates[0];
  if (!firstDueDate) return "ACTIVE_CREDIT";

  const today = todayInTanzania();
  const dueKey = dateKeyInTanzania(firstDueDate);
  const todayKey = dateKeyInTanzania(today);
  if (dueKey < todayKey) return "OVERDUE";
  if (dueKey === todayKey) return "DUE_TODAY";
  if (dueKey <= dateKeyInTanzania(addDays(today, dueSoonDays))) return "DUE_SOON";
  return "ACTIVE_CREDIT";
}
