import type { CustomerStatus } from "@/lib/constants";
import { customerStatus } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";

export const CUSTOMER_FILTERS = ["all", "balance", "paid", "due-soon", "overdue"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];

type CreditRow = {
  id: string;
  amount: number;
  dueDate: Date | null;
  status: string;
  transactionDate: Date;
  createdAt: Date;
  description?: string | null;
  reversalReason?: string | null;
  createdBy?: { name: string } | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  paymentDate: Date;
  createdAt: Date;
  notes?: string | null;
  paymentMethod?: string;
  reference?: string | null;
  reversalReason?: string | null;
  createdBy?: { name: string } | null;
};

export type CustomerHistoryEntry = {
  id: string;
  type: "CREDIT" | "PAYMENT";
  status: string;
  amountTzs: number;
  occurredAt: Date;
  dueDate: Date | null;
  description: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  reversalReason: string | null;
  createdAt: Date;
  createdBy: { name: string } | null;
  balanceTzs: number;
  reversal: { id: string } | null;
};

export function buildCustomerFinancials(credits: CreditRow[], payments: PaymentRow[]) {
  const activeCredits = credits
    .filter((credit) => credit.status === "ACTIVE")
    .sort(
      (left, right) =>
        left.transactionDate.getTime() - right.transactionDate.getTime() ||
        left.createdAt.getTime() - right.createdAt.getTime(),
    );
  const activePayments = payments.filter((payment) => payment.status === "ACTIVE");
  const totalCreditTzs = activeCredits.reduce((sum, credit) => sum + credit.amount, 0);
  const totalPaidTzs = activePayments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceTzs = totalCreditTzs - totalPaidTzs;

  let unappliedPayments = totalPaidTzs;
  const outstandingCredits = activeCredits
    .map((credit) => {
      const applied = Math.min(unappliedPayments, credit.amount);
      unappliedPayments -= applied;
      return { ...credit, outstandingTzs: credit.amount - applied };
    })
    .filter((credit) => credit.outstandingTzs > 0);

  const statusEntries = outstandingCredits.map((credit) => ({
    type: "CREDIT" as const,
    amountTzs: credit.outstandingTzs,
    dueDate: credit.dueDate,
  }));
  const status = customerStatus(balanceTzs, statusEntries);
  const oldestOutstanding = outstandingCredits[0]
    ? {
        date: outstandingCredits[0].transactionDate,
        amountTzs: outstandingCredits[0].outstandingTzs,
      }
    : null;
  const nextDueDate =
    outstandingCredits
      .flatMap((credit) => (credit.dueDate ? [credit.dueDate] : []))
      .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  const lastPayment =
    activePayments
      .map((payment) => payment.paymentDate)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

  const chronological = [
    ...credits.map((credit) => ({
      id: credit.id,
      type: "CREDIT" as const,
      status: credit.status,
      amountTzs: credit.amount,
      occurredAt: credit.transactionDate,
      dueDate: credit.dueDate,
      description: credit.description ?? null,
      paymentMethod: null,
      paymentReference: null,
      reversalReason: credit.reversalReason ?? null,
      createdAt: credit.createdAt,
      createdBy: credit.createdBy ?? null,
    })),
    ...payments.map((payment) => ({
      id: payment.id,
      type: "PAYMENT" as const,
      status: payment.status,
      amountTzs: payment.amount,
      occurredAt: payment.paymentDate,
      dueDate: null,
      description: payment.notes ?? null,
      paymentMethod: payment.paymentMethod ?? null,
      paymentReference: payment.reference ?? null,
      reversalReason: payment.reversalReason ?? null,
      createdAt: payment.createdAt,
      createdBy: payment.createdBy ?? null,
    })),
  ].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() ||
      left.createdAt.getTime() - right.createdAt.getTime(),
  );

  let runningBalance = 0;
  const history: CustomerHistoryEntry[] = chronological.map((entry) => {
    if (entry.status === "ACTIVE") {
      runningBalance += entry.type === "CREDIT" ? entry.amountTzs : -entry.amountTzs;
    }
    return {
      ...entry,
      balanceTzs: runningBalance,
      reversal: entry.status === "ACTIVE" ? null : { id: entry.id },
    };
  });

  return {
    totalCreditTzs,
    totalPaidTzs,
    balanceTzs,
    status,
    lastPayment,
    oldestOutstanding,
    nextDueDate,
    history: history.reverse(),
  };
}

function searchVariants(search?: string) {
  const value = search?.trim();
  if (!value) return [];
  const compact = value.replace(/[\s()-]/g, "");
  const phone = compact.startsWith("0")
    ? `+255${compact.slice(1)}`
    : compact.startsWith("255")
      ? `+${compact}`
      : compact;
  return [...new Set([value, compact, phone].filter(Boolean))];
}

export function matchesCustomerFilter(
  customer: { balanceTzs: number; status: CustomerStatus },
  filter: CustomerFilter,
) {
  if (filter === "balance") return customer.balanceTzs > 0;
  if (filter === "paid") return customer.status === "PAID";
  if (filter === "due-soon") return ["DUE_SOON", "DUE_TODAY"].includes(customer.status);
  if (filter === "overdue") return customer.status === "OVERDUE";
  return true;
}

export async function getCustomerList(
  businessId: string,
  search?: string,
  filter: CustomerFilter = "all",
) {
  const variants = searchVariants(search);
  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      active: true,
      ...(variants.length
        ? {
            OR: [
              { fullName: { contains: variants[0], mode: "insensitive" as const } },
              { customerNumber: { contains: variants[0], mode: "insensitive" as const } },
              ...variants.flatMap((value) => [
                { phone: { contains: value } },
                { alternativePhone: { contains: value } },
              ]),
            ],
          }
        : {}),
    },
    include: {
      creditTransactions: {
        select: {
          id: true,
          amount: true,
          dueDate: true,
          status: true,
          transactionDate: true,
          createdAt: true,
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentDate: true,
          createdAt: true,
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  return customers
    .map((customer) => {
      const financials = buildCustomerFinancials(customer.creditTransactions, customer.payments);
      const latest = financials.history[0] ?? null;
      return {
        ...customer,
        phoneE164: customer.phone ?? customer.normalizedPhone,
        balanceTzs: financials.balanceTzs,
        status: financials.status,
        lastTransaction: latest
          ? { type: latest.type, amountTzs: latest.amountTzs, occurredAt: latest.occurredAt }
          : null,
      };
    })
    .filter((customer) => matchesCustomerFilter(customer, filter));
}

export async function getCustomerDetail(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      creditTransactions: {
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      },
      payments: {
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      },
      smsMessages: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!customer) return null;

  const financials = buildCustomerFinancials(customer.creditTransactions, customer.payments);
  return {
    ...customer,
    phoneE164: customer.phone ?? customer.normalizedPhone,
    ledgerEntries: financials.history,
    smsMessages: customer.smsMessages.map((message) => ({ ...message, kind: message.type })),
    ...financials,
  };
}

export async function getDashboardData(businessId: string) {
  const [customers, credits, payments] = await Promise.all([
    getCustomerList(businessId),
    prisma.creditTransaction.findMany({
      where: { businessId },
      include: { customer: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.payment.findMany({
      where: { businessId },
      include: { customer: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const outstandingTzs = customers.reduce((sum, customer) => sum + customer.balanceTzs, 0);
  const dueCustomers = customers.filter((customer) =>
    ["DUE_SOON", "DUE_TODAY", "OVERDUE"].includes(customer.status),
  );
  const recentActivity = [
    ...credits.map((credit) => ({
      id: credit.id,
      customerId: credit.customerId,
      customer: credit.customer,
      type: "CREDIT" as const,
      amountTzs: credit.amount,
      occurredAt: credit.transactionDate,
      createdAt: credit.createdAt,
    })),
    ...payments.map((payment) => ({
      id: payment.id,
      customerId: payment.customerId,
      customer: payment.customer,
      type: "PAYMENT" as const,
      amountTzs: payment.amount,
      occurredAt: payment.paymentDate,
      createdAt: payment.createdAt,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8);

  return { customers, outstandingTzs, dueCustomers, recentActivity };
}
