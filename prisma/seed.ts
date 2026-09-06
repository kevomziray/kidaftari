import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ids = {
  business: "10000000-0000-4000-8000-000000000001",
  owner: "10000000-0000-4000-8000-000000000002",
  staff: "10000000-0000-4000-8000-000000000003",
  asha: "10000000-0000-4000-8000-000000000101",
  baraka: "10000000-0000-4000-8000-000000000102",
  neema: "10000000-0000-4000-8000-000000000103",
  juma: "10000000-0000-4000-8000-000000000104",
  ashaCredit: "10000000-0000-4000-8000-000000000201",
  barakaCredit: "10000000-0000-4000-8000-000000000202",
  neemaCredit: "10000000-0000-4000-8000-000000000203",
  reversedCredit: "10000000-0000-4000-8000-000000000204",
  ashaPayment: "10000000-0000-4000-8000-000000000301",
  barakaPayment: "10000000-0000-4000-8000-000000000302",
  cancelledPayment: "10000000-0000-4000-8000-000000000303",
  reminder: "10000000-0000-4000-8000-000000000401",
  sms: "10000000-0000-4000-8000-000000000501",
};

const fixtureDate = {
  credit: new Date("2026-08-20T09:00:00.000Z"),
  payment: new Date("2026-08-22T10:00:00.000Z"),
  dueSoon: new Date("2026-09-12T12:00:00.000Z"),
  overdue: new Date("2026-08-28T12:00:00.000Z"),
};

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "Refusing to seed production. Set ALLOW_PRODUCTION_SEED=true only intentionally.",
    );
  }

  const passwordHash = await bcrypt.hash("DemoPassword123!", 12);

  await prisma.business.upsert({
    where: { id: ids.business },
    update: {},
    create: {
      id: ids.business,
      businessName: "KIDAFTARI Demo Shop",
      businessPhone: "+255712000001",
      businessEmail: "demo-business@kidaftari.test",
      address: "Dar es Salaam, Tanzania",
      currency: "TZS",
      timezone: "Africa/Dar_es_Salaam",
      language: "EN",
    },
  });

  await prisma.user.upsert({
    where: { email: "owner@kidaftari.test" },
    update: {},
    create: {
      id: ids.owner,
      businessId: ids.business,
      name: "Demo Owner",
      email: "owner@kidaftari.test",
      phone: "+255712000002",
      passwordHash,
      role: "OWNER",
    },
  });
  await prisma.user.upsert({
    where: { email: "staff@kidaftari.test" },
    update: {},
    create: {
      id: ids.staff,
      businessId: ids.business,
      name: "Demo Staff",
      email: "staff@kidaftari.test",
      phone: "+255712000003",
      passwordHash,
      role: "STAFF",
    },
  });

  const customers = [
    {
      id: ids.asha,
      customerNumber: "CUS-DEMO-001",
      fullName: "Asha Mrema",
      phone: "+255712000101",
      alternativePhone: "+255713000101",
      creditLimit: 100_000,
      defaultDueDays: 14,
      notes: "Prefers SMS reminders in English.",
    },
    {
      id: ids.baraka,
      customerNumber: "CUS-DEMO-002",
      fullName: "Baraka Juma",
      phone: "+255712000102",
      alternativePhone: null,
      creditLimit: 50_000,
      defaultDueDays: 7,
      notes: "Usually pays by mobile money.",
    },
    {
      id: ids.neema,
      customerNumber: "CUS-DEMO-003",
      fullName: "Neema Kweka",
      phone: "+255712000103",
      alternativePhone: null,
      creditLimit: 150_000,
      defaultDueDays: 7,
      notes: "Overdue demo customer.",
    },
    {
      id: ids.juma,
      customerNumber: "CUS-DEMO-004",
      fullName: "Juma Hassan",
      phone: "+255712000104",
      alternativePhone: null,
      creditLimit: null,
      defaultDueDays: null,
      notes: "New customer with no transactions yet.",
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: {
        businessId_customerNumber: {
          businessId: ids.business,
          customerNumber: customer.customerNumber,
        },
      },
      update: {},
      create: {
        ...customer,
        businessId: ids.business,
        normalizedPhone: customer.phone,
        preferredLanguage: "EN",
        createdById: ids.owner,
        updatedById: ids.owner,
      },
    });
  }

  const credits = [
    {
      id: ids.ashaCredit,
      transactionNumber: "CR-DEMO-001",
      customerId: ids.asha,
      amount: 50_000,
      description: "Household goods bought on credit",
      transactionDate: fixtureDate.credit,
      dueDate: fixtureDate.dueSoon,
      status: "ACTIVE" as const,
      idempotencyKey: "seed-credit-001",
    },
    {
      id: ids.barakaCredit,
      transactionNumber: "CR-DEMO-002",
      customerId: ids.baraka,
      amount: 30_000,
      description: "Wholesale stock credit",
      transactionDate: fixtureDate.credit,
      dueDate: fixtureDate.dueSoon,
      status: "ACTIVE" as const,
      idempotencyKey: "seed-credit-002",
    },
    {
      id: ids.neemaCredit,
      transactionNumber: "CR-DEMO-003",
      customerId: ids.neema,
      amount: 75_000,
      description: "Goods purchased on credit",
      transactionDate: fixtureDate.credit,
      dueDate: fixtureDate.overdue,
      status: "ACTIVE" as const,
      idempotencyKey: "seed-credit-003",
    },
    {
      id: ids.reversedCredit,
      transactionNumber: "CR-DEMO-004",
      customerId: ids.neema,
      amount: 10_000,
      description: "Incorrectly entered credit — retained for audit",
      transactionDate: fixtureDate.credit,
      dueDate: fixtureDate.dueSoon,
      status: "REVERSED" as const,
      reversedAt: fixtureDate.payment,
      reversedById: ids.owner,
      reversalReason: "Amount entered in error.",
      idempotencyKey: "seed-credit-004",
    },
  ];

  for (const credit of credits) {
    await prisma.creditTransaction.upsert({
      where: {
        businessId_transactionNumber: {
          businessId: ids.business,
          transactionNumber: credit.transactionNumber,
        },
      },
      update: {},
      create: { ...credit, businessId: ids.business, createdById: ids.owner },
    });
  }

  const payments = [
    {
      id: ids.ashaPayment,
      paymentNumber: "PM-DEMO-001",
      customerId: ids.asha,
      amount: 15_000,
      paymentMethod: "MOBILE_MONEY" as const,
      reference: "MPESA-DEMO-001",
      paymentDate: fixtureDate.payment,
      notes: "Partial payment received",
      status: "ACTIVE" as const,
      idempotencyKey: "seed-payment-001",
    },
    {
      id: ids.barakaPayment,
      paymentNumber: "PM-DEMO-002",
      customerId: ids.baraka,
      amount: 30_000,
      paymentMethod: "CASH" as const,
      reference: null,
      paymentDate: fixtureDate.payment,
      notes: "Full payment received",
      status: "ACTIVE" as const,
      idempotencyKey: "seed-payment-002",
    },
    {
      id: ids.cancelledPayment,
      paymentNumber: "PM-DEMO-003",
      customerId: ids.neema,
      amount: 5_000,
      paymentMethod: "OTHER" as const,
      reference: "VOID-DEMO-003",
      paymentDate: fixtureDate.payment,
      notes: "Cancelled duplicate payment",
      status: "CANCELLED" as const,
      reversedAt: fixtureDate.payment,
      reversedById: ids.owner,
      reversalReason: "Duplicate entry; no funds were received.",
      idempotencyKey: "seed-payment-003",
    },
  ];

  for (const payment of payments) {
    await prisma.payment.upsert({
      where: {
        businessId_paymentNumber: {
          businessId: ids.business,
          paymentNumber: payment.paymentNumber,
        },
      },
      update: {},
      create: { ...payment, businessId: ids.business, createdById: ids.staff },
    });
  }

  await prisma.reminder.upsert({
    where: { idempotencyKey: "seed-reminder-001" },
    update: {},
    create: {
      id: ids.reminder,
      businessId: ids.business,
      customerId: ids.neema,
      creditTransactionId: ids.neemaCredit,
      kind: "OVERDUE",
      scheduledAt: new Date("2026-09-02T06:00:00.000Z"),
      message: "KIDAFTARI Demo Shop: Hello Neema Kweka, your balance is TZS 75,000.",
      idempotencyKey: "seed-reminder-001",
      createdById: ids.owner,
    },
  });

  await prisma.smsMessage.upsert({
    where: { idempotencyKey: "seed-sms-001" },
    update: {},
    create: {
      id: ids.sms,
      businessId: ids.business,
      customerId: ids.neema,
      creditTransactionId: ids.neemaCredit,
      reminderId: ids.reminder,
      type: "REMINDER",
      phoneNumber: "+255712000103",
      message: "KIDAFTARI Demo Shop: Hello Neema Kweka, your balance is TZS 75,000.",
      status: "QUEUED",
      idempotencyKey: "seed-sms-001",
      scheduledAt: new Date("2026-09-02T06:00:00.000Z"),
      createdById: ids.owner,
    },
  });

  await prisma.auditLog.upsert({
    where: { id: "10000000-0000-4000-8000-000000000601" },
    update: {},
    create: {
      id: "10000000-0000-4000-8000-000000000601",
      businessId: ids.business,
      userId: ids.owner,
      action: "DEMO_DATA_SEEDED",
      entityType: "Business",
      entityId: ids.business,
      description: "Development-only demo data created.",
    },
  });

  console.info("Seeded KIDAFTARI demo data.");
  console.info("Owner: owner@kidaftari.test / DemoPassword123!");
  console.info("Staff: staff@kidaftari.test / DemoPassword123!");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
