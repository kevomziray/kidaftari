import { randomUUID } from "crypto";
import type { Locale, Prisma, SmsProvider } from "@prisma/client";
import { formatTzs } from "@/lib/formatters";

export type SmsSendInput = {
  to: string;
  body: string;
  senderId?: string | null;
  clientReference: string;
};
export type SmsSendResult = { providerMessageId: string };

export interface SmsProviderClient {
  readonly name: SmsProvider;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

class ConsoleSmsProvider implements SmsProviderClient {
  readonly name = "MOCK" as const;
  async send(input: SmsSendInput) {
    console.info("[KIDAFTARI SMS — not delivered externally]", input);
    return { providerMessageId: `mock-${randomUUID()}` };
  }
}

class WebhookSmsProvider implements SmsProviderClient {
  readonly name = "CUSTOM" as const;
  async send(input: SmsSendInput) {
    const url = process.env.SMS_WEBHOOK_URL;
    if (!url) throw new Error("SMS_WEBHOOK_URL is required when SMS_PROVIDER=webhook.");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.SMS_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`SMS provider returned ${response.status}.`);
    const body = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { providerMessageId: body.messageId ?? `custom-${randomUUID()}` };
  }
}

export function getSmsProvider(): SmsProviderClient {
  switch ((process.env.SMS_PROVIDER ?? "console").toLowerCase()) {
    case "console":
    case "mock":
      return new ConsoleSmsProvider();
    case "webhook":
      return new WebhookSmsProvider();
    default:
      throw new Error(
        "Unsupported SMS_PROVIDER. Use console or webhook until a provider adapter is added.",
      );
  }
}

export function paymentConfirmationText(
  locale: Locale,
  businessName: string,
  amountTzs: number,
  balanceTzs: number,
) {
  if (locale === "SW") {
    return `${businessName}: Tumepokea malipo yako ya ${formatTzs(amountTzs)}. Salio lako ni ${formatTzs(balanceTzs)}. Asante.`;
  }
  return `${businessName}: We received your payment of ${formatTzs(amountTzs)}. Your balance is ${formatTzs(balanceTzs)}. Thank you.`;
}

export function reminderText(
  locale: Locale,
  businessName: string,
  customerName: string,
  balanceTzs: number,
  dueDate?: Date | null,
) {
  const due = dueDate
    ? new Intl.DateTimeFormat(locale === "SW" ? "sw-TZ" : "en-TZ", {
        day: "numeric",
        month: "short",
      }).format(dueDate)
    : null;
  if (locale === "SW") {
    return `${businessName}: Habari ${customerName}, una salio la ${formatTzs(balanceTzs)}${due ? ` linalodaiwa ${due}` : ""}. Tafadhali lipa mapema. Asante.`;
  }
  return `${businessName}: Hello ${customerName}, your outstanding balance is ${formatTzs(balanceTzs)}${due ? `, due ${due}` : ""}. Please pay at your earliest convenience. Thank you.`;
}

export async function queuePaymentConfirmation(
  db: Prisma.TransactionClient,
  input: {
    businessId: string;
    customerId: string;
    paymentId: string;
    phoneNumber: string | null;
    senderId: string | null;
    locale: Locale;
    businessName: string;
    amountTzs: number;
    balanceTzs: number;
    createdById: string;
  },
) {
  if (!input.phoneNumber) return null;
  const idempotencyKey = `payment-confirmation:${input.paymentId}`;
  return db.smsMessage.upsert({
    where: { idempotencyKey },
    create: {
      businessId: input.businessId,
      customerId: input.customerId,
      paymentId: input.paymentId,
      type: "PAYMENT_CONFIRMATION",
      phoneNumber: input.phoneNumber,
      senderId: input.senderId,
      message: paymentConfirmationText(
        input.locale,
        input.businessName,
        input.amountTzs,
        input.balanceTzs,
      ),
      idempotencyKey,
      createdById: input.createdById,
      scheduledAt: new Date(),
    },
    update: {},
  });
}
