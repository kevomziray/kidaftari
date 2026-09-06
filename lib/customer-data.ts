import { customerStatus } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";

type LedgerViewEntry = {
  id: string;
  type: "CREDIT" | "PAYMENT";
  amountTzs: number;
  occurredAt: Date;
  dueDate: Date | null;
  description: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  reversalReason: string | null;
  createdAt: Date;
  createdBy: { name: string } | null;
  reversal: { id: string } | null;
  reversalOf: null;
};

function activeCreditStatusEntries(
  credits: Array<{ amount: number; dueDate: Date | null; status: string }>,
) {
  return credits
    .filter((credit) => credit.status === "ACTIVE")
    .map((credit) => ({
      type: "CREDIT" as const,
      amountTzs: credit.amount,
      dueDate: credit.dueDate,
    }));
}

function balanceFromRows(
  credits: Array<{ amount: number; status: string }>,
  payments: Array<{ amount: number; status: string }>,
) {
  const totalCredit = credits
    .filter((credit) => credit.status === "ACTIVE")
    .reduce((total, credit) => total + credit.amount, 0);
  const totalPayment = payments
    .filter((payment) => payment.status === "ACTIVE")
    .reduce((total, payment) => total + payment.amount, 0);
  return totalCredit - totalPayment;
}

export async function getCustomerList(businessId: string, search?: string) {
  const normalizedSearch = search?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      active: true,
      ...(normalizedSearch
        ? {
            OR: [
              { fullName: { contains: normalizedSearch, mode: "insensitive" } },
              { phone: { contains: normalizedSearch } },
              { alternativePhone: { contains: normalizedSearch } },
            ],
          }
        : {}),
    },
    include: {
      creditTransactions: { select: { amount: true, dueDate: true, status: true } },
      payments: { select: { amount: true, status: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return customers.map((customer) => {
    const balanceTzs = balanceFromRows(customer.creditTransactions, customer.payments);
    return {
      ...customer,
      // Presentation aliases keep the Stage 1 pages stable while all data comes
      // from the canonical Stage 2 models.
      phoneE164: customer.phone ?? customer.normalizedPhone,
      balanceTzs,
      status: customerStatus(balanceTzs, activeCreditStatusEntries(customer.creditTransactions)),
    };
  });
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

  const ledgerEntries: LedgerViewEntry[] = [
    ...customer.creditTransactions.map((credit) => ({
      id: credit.id,
      type: "CREDIT" as const,
      amountTzs: credit.amount,
      occurredAt: credit.transactionDate,
      dueDate: credit.dueDate,
      description: credit.description,
      paymentMethod: null,
      paymentReference: null,
      reversalReason: credit.reversalReason,
      createdAt: credit.createdAt,
      createdBy: credit.createdBy,
      reversal: credit.status === "ACTIVE" ? null : { id: credit.id },
      reversalOf: null,
    })),
    ...customer.payments.map((payment) => ({
      id: payment.id,
      type: "PAYMENT" as const,
      amountTzs: payment.amount,
      occurredAt: payment.paymentDate,
      dueDate: null,
      description: payment.notes,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.reference,
      reversalReason: payment.reversalReason,
      createdAt: payment.createdAt,
      createdBy: payment.createdBy,
      reversal: payment.status === "ACTIVE" ? null : { id: payment.id },
      reversalOf: null,
    })),
  ].sort((left, right) => {
    const dateDifference = right.occurredAt.getTime() - left.occurredAt.getTime();
    return dateDifference || right.createdAt.getTime() - left.createdAt.getTime();
  });

  const balanceTzs = balanceFromRows(customer.creditTransactions, customer.payments);
  return {
    ...customer,
    phoneE164: customer.phone ?? customer.normalizedPhone,
    ledgerEntries,
    smsMessages: customer.smsMessages.map((message) => ({ ...message, kind: message.type })),
    balanceTzs,
    status: customerStatus(balanceTzs, activeCreditStatusEntries(customer.creditTransactions)),
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
