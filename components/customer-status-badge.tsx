import type { CustomerStatus } from "@/lib/constants";

const labels: Record<CustomerStatus, string> = {
  PAID: "Paid",
  ACTIVE_CREDIT: "Active credit",
  DUE_SOON: "Due soon",
  DUE_TODAY: "Due today",
  OVERDUE: "Overdue",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase().replace("_", "-")}`}>
      {labels[status]}
    </span>
  );
}
