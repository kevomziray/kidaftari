import type { UserRole } from "@prisma/client";

export type Permission =
  | "manage_customers"
  | "record_credit"
  | "record_payment"
  | "send_reminders"
  | "reverse_transactions"
  | "view_reports"
  | "manage_business"
  | "manage_staff"
  | "view_audit";

const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    "manage_customers",
    "record_credit",
    "record_payment",
    "send_reminders",
    "reverse_transactions",
    "view_reports",
    "manage_business",
    "manage_staff",
    "view_audit",
  ],
  STAFF: ["manage_customers", "record_credit", "record_payment", "send_reminders"],
};

export function can(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!can(role, permission)) {
    throw new Error("You do not have permission to perform this action.");
  }
}
