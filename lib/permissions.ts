import type { UserRole } from "@prisma/client";

export type Permission =
  | "view_customers"
  | "add_customers"
  | "manage_customers"
  | "record_credit"
  | "record_payment"
  | "view_transactions"
  | "send_reminders"
  | "configure_reminders"
  | "configure_sms"
  | "reverse_transactions"
  | "view_reports"
  | "manage_business"
  | "manage_staff"
  | "manage_billing"
  | "change_ownership"
  | "view_audit";

const staffPermissions: readonly Permission[] = [
  "view_customers",
  "add_customers",
  "record_credit",
  "record_payment",
  "view_transactions",
];
const ownerPermissions: readonly Permission[] = [
  ...staffPermissions,
  "manage_customers",
  "send_reminders",
  "configure_reminders",
  "configure_sms",
  "reverse_transactions",
  "view_reports",
  "manage_business",
  "manage_staff",
  "manage_billing",
  "change_ownership",
  "view_audit",
];

export function can(role: UserRole, permission: Permission, canReverseTransactions = false) {
  if (role === "OWNER") return ownerPermissions.includes(permission);
  return (
    role === "STAFF" &&
    (staffPermissions.includes(permission) ||
      (permission === "reverse_transactions" && canReverseTransactions))
  );
}

export function assertPermission(
  role: UserRole,
  permission: Permission,
  canReverseTransactions = false,
) {
  if (!can(role, permission, canReverseTransactions)) {
    throw new Error("You do not have permission to perform this action.");
  }
}
