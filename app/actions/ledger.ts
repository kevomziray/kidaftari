"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { addDays, dateFromInput, todayInTanzania } from "@/lib/dates";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { scheduleCreditReminders } from "@/lib/reminders";
import { queuePaymentConfirmation, reminderText } from "@/lib/sms";
import { requireActor } from "@/lib/tenant";
import {
  getCustomerBalanceForBusiness,
  type CustomerTransactionHistoryItem,
} from "@/server/finance";
import {
  creditSchema,
  invalidState,
  manualReminderSchema,
  paymentSchema,
  reversalSchema,
  type ActionState,
} from "@/lib/validation";

function submissionId(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return /^[A-Za-z0-9_-]{12,191}$/.test(text) ? text : randomUUID();
}

function documentNumber(prefix: "CR" | "PM") {
  return `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

function actionError(error: unknown): ActionState {
  console.error("Financial action failed", error);
  return {
    message:
      error instanceof Error ? error.message : "We could not save this record. Please try again.",
  };
}

export async function recordCreditAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "record_credit");
  const parsed = creditSchema.safeParse({
    customerId: formData.get("customerId"),
    amountTzs: formData.get("amountTzs"),
    dueDate: formData.get("dueDate"),
    description: formData.get("description"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  const dueDate = parsed.data.dueDate
    ? dateFromInput(parsed.data.dueDate)
    : addDays(todayInTanzania(), actor.business.defaultCreditDueDays);
  const idempotencyKey = submissionId(formData.get("submissionId"));

  let result: { transaction: { customerId: string }; created: boolean };
  try {
    result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: parsed.data.customerId, businessId: actor.business.id, active: true },
      });
      if (!customer) throw new Error("Customer was not found or is archived.");

      const existing = await tx.creditTransaction.findFirst({
        where: { businessId: actor.business.id, idempotencyKey },
      });
      if (existing) return { transaction: existing, created: false };

      if (customer.creditLimit !== null) {
        const currentBalance = await getCustomerBalanceForBusiness(
          actor.business.id,
          customer.id,
          tx,
        );
        if (currentBalance === null) throw new Error("Customer was not found.");
        if (currentBalance + parsed.data.amountTzs > customer.creditLimit) {
          throw new Error(
            `This credit would exceed the customer's credit limit of TZS ${customer.creditLimit.toLocaleString("en-TZ")}.`,
          );
        }
      }

      const transaction = await tx.creditTransaction.create({
        data: {
          businessId: actor.business.id,
          customerId: customer.id,
          transactionNumber: documentNumber("CR"),
          amount: parsed.data.amountTzs,
          dueDate,
          description: parsed.data.description || null,
          createdById: actor.user.id,
          idempotencyKey,
        },
      });
      await scheduleCreditReminders(tx, {
        business: actor.business,
        customer,
        creditTransactionId: transaction.id,
        dueDate,
        createdById: actor.user.id,
      });
      await writeAuditLog(
        {
          businessId: actor.business.id,
          actorId: actor.user.id,
          action: "CREDIT_RECORDED",
          entityType: "CreditTransaction",
          entityId: transaction.id,
          description: "Credit transaction recorded.",
          afterData: {
            customerId: customer.id,
            transactionNumber: transaction.transactionNumber,
            amount: transaction.amount,
            dueDate: dueDate.toISOString(),
          },
        },
        tx,
      );
      return { transaction, created: true };
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.transaction.customerId}`);
  redirect(
    `/customers/${result.transaction.customerId}?credit=${result.created ? "recorded" : "already-recorded"}`,
  );
}

export async function recordPaymentAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "record_payment");
  const parsed = paymentSchema.safeParse({
    customerId: formData.get("customerId"),
    amountTzs: formData.get("amountTzs"),
    occurredAt: formData.get("occurredAt"),
    paymentMethod: formData.get("paymentMethod"),
    paymentReference: formData.get("paymentReference"),
    description: formData.get("description"),
  });
  if (!parsed.success) return invalidState(parsed.error);
  const idempotencyKey = submissionId(formData.get("submissionId"));

  let result: { payment: { customerId: string }; created: boolean };
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: parsed.data.customerId, businessId: actor.business.id, active: true },
        });
        if (!customer) throw new Error("Customer was not found or is archived.");

        const existing = await tx.payment.findFirst({
          where: { businessId: actor.business.id, idempotencyKey },
        });
        if (existing) return { payment: existing, created: false };

        const balanceTzs = await getCustomerBalanceForBusiness(actor.business.id, customer.id, tx);
        if (balanceTzs === null) throw new Error("Customer was not found.");
        if (balanceTzs <= 0 && !actor.business.allowCustomerOverpayments) {
          throw new Error("This customer has no outstanding balance to pay.");
        }
        if (parsed.data.amountTzs > balanceTzs && !actor.business.allowCustomerOverpayments) {
          throw new Error(
            `Payment cannot be more than the outstanding balance of TZS ${balanceTzs.toLocaleString("en-TZ")}.`,
          );
        }

        const payment = await tx.payment.create({
          data: {
            businessId: actor.business.id,
            customerId: customer.id,
            paymentNumber: documentNumber("PM"),
            amount: parsed.data.amountTzs,
            paymentDate: dateFromInput(parsed.data.occurredAt),
            paymentMethod: parsed.data.paymentMethod,
            reference: parsed.data.paymentReference || null,
            notes: parsed.data.description || null,
            createdById: actor.user.id,
            idempotencyKey,
          },
        });
        const remainingTzs = balanceTzs - parsed.data.amountTzs;
        if (actor.business.sendPaymentConfirmations) {
          await queuePaymentConfirmation(tx, {
            businessId: actor.business.id,
            customerId: customer.id,
            paymentId: payment.id,
            phoneNumber: customer.phone ?? customer.normalizedPhone,
            senderId: actor.business.smsSenderId ?? process.env.SMS_SENDER_ID ?? null,
            locale: actor.business.language,
            businessName: actor.business.businessName,
            amountTzs: payment.amount,
            balanceTzs: remainingTzs,
            createdById: actor.user.id,
          });
        }
        await writeAuditLog(
          {
            businessId: actor.business.id,
            actorId: actor.user.id,
            action: "PAYMENT_RECORDED",
            entityType: "Payment",
            entityId: payment.id,
            description: "Payment recorded.",
            afterData: {
              customerId: customer.id,
              paymentNumber: payment.paymentNumber,
              amount: payment.amount,
              remainingTzs,
            },
          },
          tx,
        );
        return { payment, created: true };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.payment.customerId}`);
  redirect(
    `/customers/${result.payment.customerId}?payment=${result.created ? "recorded" : "already-recorded"}`,
  );
}

export async function reverseTransactionAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(
    actor.membership.role,
    "reverse_transactions",
    actor.user.canReverseTransactions,
  );
  const parsed = reversalSchema.safeParse({
    transactionId: formData.get("transactionId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  let result: { customerId: string };
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const credit = await tx.creditTransaction.findFirst({
          where: {
            id: parsed.data.transactionId,
            businessId: actor.business.id,
            status: "ACTIVE",
          },
        });
        const payment = credit
          ? null
          : await tx.payment.findFirst({
              where: {
                id: parsed.data.transactionId,
                businessId: actor.business.id,
                status: "ACTIVE",
              },
            });
        if (!credit && !payment) {
          throw new Error("Transaction was not found or has already been reversed.");
        }

        const original = credit ?? payment!;
        const balanceTzs = await getCustomerBalanceForBusiness(
          actor.business.id,
          original.customerId,
          tx,
        );
        if (balanceTzs === null) throw new Error("Customer was not found.");
        const resultingBalance = credit ? balanceTzs - credit.amount : balanceTzs + payment!.amount;
        if (resultingBalance < 0 && !actor.business.allowCustomerOverpayments) {
          throw new Error(
            "Reverse the related payment first. This reversal would create a negative customer balance.",
          );
        }

        const reversalData = {
          status: "REVERSED" as const,
          reversedAt: new Date(),
          reversedById: actor.user.id,
          reversalReason: parsed.data.reason,
        };
        if (credit) {
          await tx.creditTransaction.update({ where: { id: credit.id }, data: reversalData });
        } else {
          await tx.payment.update({ where: { id: payment!.id }, data: reversalData });
        }
        await writeAuditLog(
          {
            businessId: actor.business.id,
            actorId: actor.user.id,
            action: "FINANCIAL_TRANSACTION_REVERSED",
            entityType: credit ? "CreditTransaction" : "Payment",
            entityId: original.id,
            description: "Financial transaction reversed; the original amount remains unchanged.",
            beforeData: {
              customerId: original.customerId,
              amount: original.amount,
              status: "ACTIVE",
            },
            afterData: {
              status: "REVERSED",
              reason: parsed.data.reason,
              resultingBalance,
            },
          },
          tx,
        );
        return { customerId: original.customerId };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.customerId}`);
  redirect(`/customers/${result.customerId}?reversed=1`);
}

export async function queueManualReminderAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "send_reminders");
  const parsed = manualReminderSchema.safeParse({ customerId: formData.get("customerId") });
  if (!parsed.success) return invalidState(parsed.error);
  const limit = checkRateLimit(
    `manual-sms:${actor.business.id}:${parsed.data.customerId}`,
    5,
    60 * 60 * 1000,
  );
  if (!limit.allowed) {
    return {
      message: `Too many reminders for this customer. Try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: parsed.data.customerId, businessId: actor.business.id, active: true },
    });
    const phoneNumber = customer?.phone ?? customer?.normalizedPhone;
    if (!customer || !phoneNumber) {
      return { message: "Add a valid Tanzanian mobile number before sending a reminder." };
    }
    const balanceTzs = await getCustomerBalanceForBusiness(actor.business.id, customer.id);
    if (balanceTzs === null || balanceTzs <= 0) {
      return { message: "This customer has no outstanding balance." };
    }
    await prisma.$transaction(async (tx) => {
      const message = reminderText(
        actor.business.language,
        actor.business.businessName,
        customer.fullName,
        balanceTzs,
      );
      const reminder = await tx.reminder.create({
        data: {
          businessId: actor.business.id,
          customerId: customer.id,
          kind: "MANUAL",
          scheduledAt: new Date(),
          message,
          idempotencyKey: `manual-reminder:${randomUUID()}`,
          createdById: actor.user.id,
        },
      });
      const sms = await tx.smsMessage.create({
        data: {
          businessId: actor.business.id,
          customerId: customer.id,
          reminderId: reminder.id,
          type: "REMINDER",
          phoneNumber,
          senderId: actor.business.smsSenderId ?? process.env.SMS_SENDER_ID ?? null,
          message,
          idempotencyKey: `manual-reminder-message:${reminder.id}`,
          scheduledAt: new Date(),
          createdById: actor.user.id,
        },
      });
      await writeAuditLog(
        {
          businessId: actor.business.id,
          actorId: actor.user.id,
          action: "MANUAL_REMINDER_QUEUED",
          entityType: "Reminder",
          entityId: reminder.id,
          description: "Manual SMS reminder queued.",
          afterData: { customerId: customer.id, balanceTzs, smsMessageId: sms.id },
        },
        tx,
      );
    });
    revalidatePath(`/customers/${customer.id}`);
    return { success: true, message: "Reminder queued. It will be sent shortly." };
  } catch (error) {
    return actionError(error);
  }
}

// Makes the public action module expose the shared history type in generated API
// docs without moving financial logic into a client component.
export type { CustomerTransactionHistoryItem };
