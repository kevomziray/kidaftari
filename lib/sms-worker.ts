import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSmsProvider, reminderText } from "@/lib/sms";
import { getCustomerBalanceForBusiness } from "@/server/finance";

const MAX_ATTEMPTS = 3;
const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

export async function materializeDueReminders(limit = 50) {
  const now = new Date();
  const staleClaim = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const due = await prisma.reminder.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: now },
      OR: [{ processingAt: null }, { processingAt: { lt: staleClaim } }],
    },
    include: { business: true, customer: true, creditTransaction: true },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
  let queued = 0;
  let cancelled = 0;

  for (const reminder of due) {
    const claimed = await prisma.reminder.updateMany({
      where: {
        id: reminder.id,
        status: "PENDING",
        OR: [{ processingAt: null }, { processingAt: { lt: staleClaim } }],
      },
      data: { processingAt: now },
    });
    if (!claimed.count) continue;

    const balanceTzs = await getCustomerBalanceForBusiness(
      reminder.businessId,
      reminder.customerId,
    );
    const phoneNumber = reminder.customer.phone ?? reminder.customer.normalizedPhone;
    if (balanceTzs === null || balanceTzs <= 0 || !phoneNumber) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: "CANCELLED",
          processingAt: null,
          failureReason:
            balanceTzs === null || balanceTzs <= 0
              ? "Customer balance is settled."
              : "Customer has no valid mobile number.",
        },
      });
      cancelled += 1;
      continue;
    }

    const message = reminderText(
      reminder.customer.preferredLanguage ?? reminder.business.language,
      reminder.business.businessName,
      reminder.customer.fullName,
      balanceTzs,
      reminder.creditTransaction?.dueDate,
    );
    await prisma.$transaction(async (tx) => {
      await tx.reminder.update({
        where: { id: reminder.id },
        data: { message },
      });
      await tx.smsMessage.upsert({
        where: { reminderId: reminder.id },
        create: {
          businessId: reminder.businessId,
          customerId: reminder.customerId,
          creditTransactionId: reminder.creditTransactionId,
          reminderId: reminder.id,
          type: "REMINDER",
          phoneNumber,
          senderId: reminder.business.smsSenderId ?? process.env.SMS_SENDER_ID ?? null,
          message,
          idempotencyKey: `reminder-message:${reminder.id}`,
          scheduledAt: now,
        },
        // Existing SMS jobs retain their delivery state. The reminder message is
        // updated above for auditability, but a queued outbound SMS is not reset.
        update: {},
      });
    });
    queued += 1;
  }
  return { queued, cancelled };
}

export async function deliverQueuedSms(limit = 50) {
  const now = new Date();
  const staleClaim = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  // A crashed worker must not leave a delivery permanently PROCESSING.
  await prisma.smsMessage.updateMany({
    where: { status: "PROCESSING", lastAttemptAt: { lt: staleClaim } },
    data: { status: "QUEUED" },
  });

  const messages = await prisma.smsMessage.findMany({
    where: {
      status: "QUEUED",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  const provider = getSmsProvider();

  for (const message of messages) {
    const claimed = await prisma.smsMessage.updateMany({
      where: { id: message.id, status: "QUEUED" },
      data: { status: "PROCESSING", attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
    });
    if (!claimed.count) continue;

    try {
      const result = await provider.send({
        to: message.phoneNumber,
        body: message.message,
        senderId: message.senderId,
        clientReference: message.id,
      });
      await prisma.$transaction(async (tx) => {
        await tx.smsMessage.update({
          where: { id: message.id },
          data: {
            status: "SENT",
            provider: provider.name,
            providerMessageId: result.providerMessageId,
            sentAt: new Date(),
            failureReason: null,
          },
        });
        if (message.reminderId) {
          await tx.reminder.update({
            where: { id: message.reminderId },
            data: { status: "SENT", sentAt: new Date(), processingAt: null, failureReason: null },
          });
        }
      });
      sent += 1;
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : "Unknown SMS error";
      const finalAttempt = message.attemptCount + 1 >= MAX_ATTEMPTS;
      await prisma.$transaction(async (tx) => {
        await tx.smsMessage.update({
          where: { id: message.id },
          data: finalAttempt
            ? { status: "FAILED", failureReason }
            : {
                status: "QUEUED",
                scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
                failureReason,
              },
        });
        if (message.reminderId && finalAttempt) {
          await tx.reminder.update({
            where: { id: message.reminderId },
            data: { status: "FAILED", processingAt: null, failureReason },
          });
        }
      });
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function runReminderAndSmsWorker() {
  const reminderResult = await materializeDueReminders();
  const smsResult = await deliverQueuedSms();
  return { ...reminderResult, ...smsResult, runId: randomUUID() };
}
