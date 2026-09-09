import type { Locale, Prisma } from "@prisma/client";
import { addDays, dateAtTanzaniaHour } from "@/lib/dates";
import { reminderText } from "@/lib/sms";
import { getCustomerBalanceForBusiness } from "@/server/finance";

type ReminderBusiness = {
  id: string;
  businessName: string;
  remindersEnabled: boolean;
  reminderDaysBeforeDue: number;
  reminderLocalTime: string;
  language: Locale;
};

type ReminderCustomer = {
  id: string;
  fullName: string;
  reminderEnabled: boolean;
  preferredLanguage: Locale;
};

type ScheduleInput = {
  business: ReminderBusiness;
  customer: ReminderCustomer;
  creditTransactionId: string;
  dueDate: Date | null;
  createdById?: string | null;
};

function scheduledAt(dueDate: Date, daysOffset: number, time: string) {
  const [hour] = time.split(":").map(Number);
  const date = addDays(dueDate, daysOffset);
  return dateAtTanzaniaHour(date, hour || 9);
}

/** Durable reminder jobs are stored with the financial record, never in memory. */
export async function scheduleCreditReminders(db: Prisma.TransactionClient, input: ScheduleInput) {
  const { business, dueDate, customer } = input;
  if (!business.remindersEnabled || !customer.reminderEnabled || !dueDate) return;

  const balance = await getCustomerBalanceForBusiness(business.id, customer.id, db);
  if (balance === null || balance <= 0) return;

  const jobs = [
    {
      kind: "DUE_SOON" as const,
      scheduledAt: scheduledAt(
        dueDate,
        -business.reminderDaysBeforeDue,
        business.reminderLocalTime,
      ),
      idempotencyKey: `${input.creditTransactionId}:due-soon`,
    },
    {
      kind: "DUE_TODAY" as const,
      scheduledAt: scheduledAt(dueDate, 0, business.reminderLocalTime),
      idempotencyKey: `${input.creditTransactionId}:due-today`,
    },
  ];

  for (const job of jobs) {
    await db.reminder.upsert({
      where: { idempotencyKey: job.idempotencyKey },
      create: {
        businessId: business.id,
        customerId: customer.id,
        creditTransactionId: input.creditTransactionId,
        kind: job.kind,
        scheduledAt: job.scheduledAt < new Date() ? new Date() : job.scheduledAt,
        message: reminderText(
          customer.preferredLanguage,
          business.businessName,
          customer.fullName,
          balance,
          dueDate,
        ),
        idempotencyKey: job.idempotencyKey,
        createdById: input.createdById ?? null,
      },
      update: {},
    });
  }
}
