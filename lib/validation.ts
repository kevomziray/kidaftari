import { z } from "zod";
import { MAX_TZS_AMOUNT } from "@/lib/constants";

const requiredText = (label: string, max = 160) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const optionalText = (max = 500) =>
  z.string().trim().max(max, "This is too long.").optional().or(z.literal(""));

const money = z.coerce
  .number("Enter an amount.")
  .int("TZS amounts must be whole numbers.")
  .positive("Amount must be greater than zero.")
  .max(MAX_TZS_AMOUNT, "Amount is too large.");

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");

export const customerSchema = z.object({
  fullName: requiredText("Customer name"),
  phone: requiredText("Phone number", 32),
  alternativePhone: optionalText(32),
  address: optionalText(1000),
  notes: optionalText(2000),
  creditLimit: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(0).max(MAX_TZS_AMOUNT).optional(),
  ),
  reminderEnabled: z.boolean(),
  reminderFrequency: z.coerce.number().int().min(1).max(365),
  preferredLanguage: z.enum(["EN", "SW"]),
});

export const creditSchema = z.object({
  customerId: z.string().uuid("Choose a customer."),
  amountTzs: money,
  dueDate: dateText.optional().or(z.literal("")),
  description: optionalText(1000),
});

export const paymentSchema = z.object({
  customerId: z.string().uuid("Choose a customer."),
  amountTzs: money,
  occurredAt: dateText,
  paymentMethod: z.enum(["CASH", "MOBILE_MONEY", "BANK", "OTHER"]),
  paymentReference: optionalText(120),
  description: optionalText(1000),
});

export const reversalSchema = z.object({
  transactionId: z.string().uuid(),
  reason: requiredText("Reason", 1000),
});

export const manualReminderSchema = z.object({
  customerId: z.string().uuid(),
});

export const businessSettingsSchema = z.object({
  name: requiredText("Business name"),
  phone: optionalText(32),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(320)
    .optional()
    .or(z.literal("")),
  address: optionalText(1000),
  locale: z.enum(["EN", "SW"]),
  defaultCreditDueDays: z.coerce.number().int().min(0).max(365),
  remindersEnabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  reminderDaysBeforeDue: z.coerce.number().int().min(0).max(30),
  overdueReminderIntervalDays: z.coerce.number().int().min(1).max(90),
  reminderLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM."),
  sendPaymentConfirmations: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type ActionState = {
  message?: string;
  success?: boolean;
  errors?: Record<string, string[] | undefined>;
};

export function invalidState(error: z.ZodError): ActionState {
  return { message: "Please correct the highlighted fields.", errors: error.flatten().fieldErrors };
}
