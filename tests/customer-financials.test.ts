import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findMany: vi.fn(), findFirst: vi.fn() },
    creditTransaction: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
  },
}));

import {
  buildCustomerFinancials,
  getCustomerList,
  getCustomerDetail,
  matchesCustomerFilter,
} from "@/lib/customer-data";
import { prisma } from "@/lib/prisma";

const date = (value: string) => new Date(value + "T08:00:00.000Z");

describe("customer balances and summaries", () => {
  it("uses active rows, allocates payments FIFO, and keeps reversed rows visible", () => {
    const financials = buildCustomerFinancials(
      [
        {
          id: "credit-1",
          amount: 10_000,
          dueDate: date("2026-09-05"),
          status: "ACTIVE",
          transactionDate: date("2026-09-01"),
          createdAt: date("2026-09-01"),
        },
        {
          id: "credit-2",
          amount: 8_000,
          dueDate: date("2026-09-12"),
          status: "ACTIVE",
          transactionDate: date("2026-09-08"),
          createdAt: date("2026-09-08"),
        },
        {
          id: "credit-reversed",
          amount: 50_000,
          dueDate: date("2026-09-10"),
          status: "REVERSED",
          transactionDate: date("2026-09-10"),
          createdAt: date("2026-09-10"),
        },
      ],
      [
        {
          id: "payment-1",
          amount: 12_000,
          status: "ACTIVE",
          paymentDate: date("2026-09-09"),
          createdAt: date("2026-09-09"),
        },
      ],
    );

    expect(financials).toMatchObject({
      totalCreditTzs: 18_000,
      totalPaidTzs: 12_000,
      balanceTzs: 6_000,
      oldestOutstanding: { amountTzs: 6_000 },
    });
    expect(financials.oldestOutstanding?.date).toEqual(date("2026-09-08"));
    expect(financials.nextDueDate).toEqual(date("2026-09-12"));
    expect(financials.lastPayment).toEqual(date("2026-09-09"));
    expect(financials.history[0]).toMatchObject({
      id: "credit-reversed",
      balanceTzs: 6_000,
      reversal: { id: "credit-reversed" },
    });
    expect(financials.history.find((entry) => entry.id === "payment-1")?.balanceTzs).toBe(6_000);
  });

  it("supports all customer filters", () => {
    expect(matchesCustomerFilter({ balanceTzs: 100, status: "OVERDUE" }, "balance")).toBe(true);
    expect(matchesCustomerFilter({ balanceTzs: 0, status: "PAID" }, "paid")).toBe(true);
    expect(matchesCustomerFilter({ balanceTzs: 100, status: "DUE_TODAY" }, "due-soon")).toBe(true);
    expect(matchesCustomerFilter({ balanceTzs: 100, status: "OVERDUE" }, "overdue")).toBe(true);
    expect(matchesCustomerFilter({ balanceTzs: 0, status: "PAID" }, "balance")).toBe(false);
  });

  it("searches customer number and local Tanzania phone within one tenant", async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
    await getCustomerList("business-one", "0712", "all");
    const query = vi.mocked(prisma.customer.findMany).mock.calls[0][0]!;
    expect(query.where).toMatchObject({ businessId: "business-one", active: true });
    expect(JSON.stringify(query.where)).toContain("customerNumber");
    expect(JSON.stringify(query.where)).toContain("+255712");
  });

  it("looks up customer profiles by id and business together", async () => {
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    await expect(
      getCustomerDetail("business-one", "customer-from-another-business"),
    ).resolves.toBeNull();
    expect(vi.mocked(prisma.customer.findFirst).mock.calls[0][0]?.where).toEqual({
      id: "customer-from-another-business",
      businessId: "business-one",
    });
  });
});
