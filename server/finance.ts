import "server-only";

import type { FinancialStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/lib/tenant";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

export type CustomerTransactionHistoryItem = {
  id: string;
  kind: "CREDIT" | "PAYMENT";
  number: string;
  amount: number;
  status: FinancialStatus;
  occurredAt: Date;
  createdAt: Date;
  description: string | null;
  dueDate: Date | null;
  paymentMethod: string | null;
  reference: string | null;
  reversalReason: string | null;
};

async function customerExistsForBusiness(
  db: DatabaseClient,
  businessId: string,
  customerId: string,
) {
  return db.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });
}

/**
 * Trusted, tenant-scoped balance primitive for server actions and background jobs.
 * It returns `null` for a customer outside the supplied tenant rather than leaking
 * a zero balance that could be mistaken for a real customer.
 */
export async function getCustomerBalanceForBusiness(
  businessId: string,
  customerId: string,
  db: DatabaseClient = prisma,
): Promise<number | null> {
  const customer = await customerExistsForBusiness(db, businessId, customerId);
  if (!customer) return null;

  const [credits, payments] = await Promise.all([
    db.creditTransaction.aggregate({
      where: { businessId, customerId, status: "ACTIVE" },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { businessId, customerId, status: "ACTIVE" },
      _sum: { amount: true },
    }),
  ]);

  return (credits._sum.amount ?? 0) - (payments._sum.amount ?? 0);
}

/**
 * Gets the current actor first so a caller can never use a customer ID alone to
 * query another tenant's financial data.
 */
export async function getCustomerBalance(customerId: string): Promise<number | null> {
  const actor = await requireActor();
  return getCustomerBalanceForBusiness(actor.business.id, customerId);
}

/** Trusted tenant-scoped aggregate for server-side reporting and scheduled jobs. */
export async function getBusinessOutstandingBalanceForBusiness(
  businessId: string,
  db: DatabaseClient = prisma,
): Promise<number> {
  const [credits, payments] = await Promise.all([
    db.creditTransaction.aggregate({
      where: { businessId, status: "ACTIVE" },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { businessId, status: "ACTIVE" },
      _sum: { amount: true },
    }),
  ]);

  return (credits._sum.amount ?? 0) - (payments._sum.amount ?? 0);
}

/**
 * Public business aggregate. The requested business ID is always compared to the
 * authenticated actor's tenant before any aggregation occurs.
 */
export async function getBusinessOutstandingBalance(businessId: string): Promise<number> {
  const actor = await requireActor();
  if (actor.business.id !== businessId) {
    throw new Error("You do not have access to this business.");
  }
  return getBusinessOutstandingBalanceForBusiness(businessId);
}

/** Trusted tenant-scoped history primitive. Reversed and cancelled rows remain. */
export async function getCustomerTransactionHistoryForBusiness(
  businessId: string,
  customerId: string,
  db: DatabaseClient = prisma,
): Promise<CustomerTransactionHistoryItem[] | null> {
  const customer = await customerExistsForBusiness(db, businessId, customerId);
  if (!customer) return null;

  const [credits, payments] = await Promise.all([
    db.creditTransaction.findMany({
      where: { businessId, customerId },
      select: {
        id: true,
        transactionNumber: true,
        amount: true,
        status: true,
        transactionDate: true,
        createdAt: true,
        description: true,
        dueDate: true,
        reversalReason: true,
      },
    }),
    db.payment.findMany({
      where: { businessId, customerId },
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        status: true,
        paymentDate: true,
        createdAt: true,
        notes: true,
        paymentMethod: true,
        reference: true,
        reversalReason: true,
      },
    }),
  ]);

  return [
    ...credits.map<CustomerTransactionHistoryItem>((credit) => ({
      id: credit.id,
      kind: "CREDIT",
      number: credit.transactionNumber,
      amount: credit.amount,
      status: credit.status,
      occurredAt: credit.transactionDate,
      createdAt: credit.createdAt,
      description: credit.description,
      dueDate: credit.dueDate,
      paymentMethod: null,
      reference: null,
      reversalReason: credit.reversalReason,
    })),
    ...payments.map<CustomerTransactionHistoryItem>((payment) => ({
      id: payment.id,
      kind: "PAYMENT",
      number: payment.paymentNumber,
      amount: payment.amount,
      status: payment.status,
      occurredAt: payment.paymentDate,
      createdAt: payment.createdAt,
      description: payment.notes,
      dueDate: null,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      reversalReason: payment.reversalReason,
    })),
  ].sort((left, right) => {
    const dateDifference = right.occurredAt.getTime() - left.occurredAt.getTime();
    if (dateDifference !== 0) return dateDifference;
    const createdDifference = right.createdAt.getTime() - left.createdAt.getTime();
    if (createdDifference !== 0) return createdDifference;
    return right.id.localeCompare(left.id);
  });
}

/** Customer history for the signed-in actor's business only. */
export async function getCustomerTransactionHistory(
  customerId: string,
): Promise<CustomerTransactionHistoryItem[] | null> {
  const actor = await requireActor();
  return getCustomerTransactionHistoryForBusiness(actor.business.id, customerId);
}
