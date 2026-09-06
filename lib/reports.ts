import { getCustomerList } from "@/lib/customer-data";
import { todayInTanzania } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

function monthBounds(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function getReportsData(businessId: string) {
  const { start, end } = monthBounds(todayInTanzania());
  const [credits, payments, customers] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { businessId, transactionDate: { gte: start, lt: end } },
      select: { amount: true, status: true },
    }),
    prisma.payment.findMany({
      where: { businessId, paymentDate: { gte: start, lt: end } },
      select: { amount: true, status: true },
    }),
    getCustomerList(businessId),
  ]);
  const creditRecordedTzs = credits
    .filter((credit) => credit.status === "ACTIVE")
    .reduce((sum, credit) => sum + credit.amount, 0);
  const paymentsReceivedTzs = payments
    .filter((payment) => payment.status === "ACTIVE")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingTzs = customers.reduce((sum, customer) => sum + customer.balanceTzs, 0);
  const overdueCustomers = customers.filter((customer) => customer.status === "OVERDUE");
  return {
    start,
    end,
    creditRecordedTzs,
    paymentsReceivedTzs,
    outstandingTzs,
    overdueTzs: overdueCustomers.reduce((sum, customer) => sum + customer.balanceTzs, 0),
    activeDebtors: customers.filter((customer) => customer.balanceTzs > 0).length,
    overdueCustomers: overdueCustomers.sort((a, b) => b.balanceTzs - a.balanceTzs),
    topDebtors: customers
      .filter((customer) => customer.balanceTzs > 0)
      .sort((a, b) => b.balanceTzs - a.balanceTzs)
      .slice(0, 10),
  };
}
