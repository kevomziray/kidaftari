import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const demoBusinessId = "10000000-0000-4000-8000-000000000001";

async function main() {
  const business = await prisma.business.findUnique({
    where: { id: demoBusinessId },
    include: {
      users: true,
      customers: {
        include: {
          creditTransactions: { include: { customer: true } },
          payments: { include: { customer: true } },
        },
      },
      reminders: { include: { customer: true, creditTransaction: true } },
      smsMessages: { include: { customer: true, reminder: true } },
    },
  });
  assert.ok(business, "Demo business was not found. Run db:seed first.");
  assert.equal(business.users.filter((user) => user.role === "OWNER").length, 1);
  assert.equal(business.users.filter((user) => user.role === "STAFF").length, 1);
  assert.equal(business.customers.length, 4);

  let outstandingBalance = 0;
  for (const customer of business.customers) {
    assert.equal(customer.businessId, business.id, "Customer tenant does not match business.");
    for (const credit of customer.creditTransactions) {
      assert.equal(credit.businessId, business.id, "Credit tenant does not match business.");
      assert.equal(credit.customer.businessId, business.id, "Credit customer crosses tenants.");
    }
    for (const payment of customer.payments) {
      assert.equal(payment.businessId, business.id, "Payment tenant does not match business.");
      assert.equal(payment.customer.businessId, business.id, "Payment customer crosses tenants.");
    }

    const creditTotal = customer.creditTransactions
      .filter((credit) => credit.status === "ACTIVE")
      .reduce((total, credit) => total + credit.amount, 0);
    const paymentTotal = customer.payments
      .filter((payment) => payment.status === "ACTIVE")
      .reduce((total, payment) => total + payment.amount, 0);
    outstandingBalance += creditTotal - paymentTotal;
  }

  assert.equal(outstandingBalance, 110_000, "Demo outstanding balance should be TZS 110,000.");
  assert.ok(
    business.reminders.every(
      (reminder) =>
        reminder.businessId === business.id &&
        reminder.customer.businessId === business.id &&
        (!reminder.creditTransaction || reminder.creditTransaction.businessId === business.id),
    ),
    "A reminder crosses tenant boundaries.",
  );
  assert.ok(
    business.smsMessages.every(
      (message) =>
        message.businessId === business.id &&
        (!message.customer || message.customer.businessId === business.id) &&
        (!message.reminder || message.reminder.businessId === business.id),
    ),
    "An SMS message crosses tenant boundaries.",
  );

  console.info("Stage 2 demo relationships verified. Outstanding balance: TZS 110,000.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
