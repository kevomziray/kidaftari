-- Stage 2: canonical multi-tenant credit, payment, reminder, and SMS foundation.
--
-- This migration is intentionally additive. The Stage 1 ledger/membership tables
-- remain in place as read-only historical data, then are backfilled into the new
-- canonical tables. No financial history is deleted or overwritten.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'STAFF');
CREATE TYPE "FinancialStatus" AS ENUM ('ACTIVE', 'REVERSED', 'CANCELLED');
CREATE TYPE "PaymentMethodV2" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK', 'OTHER');
CREATE TYPE "ReminderKindV2" AS ENUM ('DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'MANUAL');
CREATE TYPE "ReminderStatusV2" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "SmsType" AS ENUM ('PAYMENT_CONFIRMATION', 'CREDIT_CREATED', 'REMINDER', 'STATEMENT', 'OTHER');

-- A Stage 2 user has one authoritative tenant and role. Existing users are
-- assigned their earliest active legacy membership before the column becomes
-- required. Fail clearly rather than guessing if an orphaned user exists.
ALTER TABLE "User" ADD COLUMN "businessId" UUID;
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STAFF';

WITH primary_membership AS (
    SELECT DISTINCT ON ("userId") "userId", "businessId", "role"
    FROM "BusinessMembership"
    WHERE "isActive" = true
    ORDER BY "userId", "createdAt" ASC
)
UPDATE "User" AS "user"
SET
    "businessId" = primary_membership."businessId",
    "role" = CASE
        WHEN primary_membership."role" = 'OWNER' THEN 'OWNER'::"UserRole"
        ELSE 'STAFF'::"UserRole"
    END
FROM primary_membership
WHERE "user"."id" = primary_membership."userId";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "User" WHERE "businessId" IS NULL) THEN
        RAISE EXCEPTION
            'Stage 2 migration stopped: every user needs an active business membership before businessId can be required.';
    END IF;
END $$;

ALTER TABLE "User" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "User"
    ADD CONSTRAINT "User_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_businessId_isActive_idx" ON "User"("businessId", "isActive");
CREATE UNIQUE INDEX "User_businessId_id_key" ON "User"("businessId", "id");

-- Customer metadata and tenant-safe customer numbers.
ALTER TABLE "Customer" ADD COLUMN "customerNumber" VARCHAR(50);
ALTER TABLE "Customer" ADD COLUMN "alternativePhone" VARCHAR(32);
ALTER TABLE "Customer" ADD COLUMN "creditLimit" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Customer" ADD COLUMN "reminderFrequency" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Customer" ADD COLUMN "preferredLanguage" "Locale" NOT NULL DEFAULT 'EN';

UPDATE "Customer"
SET "customerNumber" = 'CUS-' || upper(replace("id"::text, '-', ''))
WHERE "customerNumber" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "customerNumber" SET NOT NULL;
ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_creditLimit_nonnegative"
    CHECK ("creditLimit" IS NULL OR "creditLimit" >= 0);
ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_reminderFrequency_positive"
    CHECK ("reminderFrequency" > 0);
CREATE UNIQUE INDEX "Customer_businessId_customerNumber_key"
    ON "Customer"("businessId", "customerNumber");
CREATE UNIQUE INDEX "Customer_businessId_id_key" ON "Customer"("businessId", "id");
CREATE INDEX "Customer_businessId_phone_idx" ON "Customer"("businessId", "phone");

-- Audit descriptions make audit entries readable without decoding JSON metadata.
ALTER TABLE "AuditLog" ADD COLUMN "description" TEXT;

-- Canonical immutable credit records.
CREATE TABLE "CreditTransaction" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "transactionNumber" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE,
    "status" "FinancialStatus" NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" VARCHAR(191),
    "correctionOfId" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditTransaction_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "CreditTransaction_businessId_transactionNumber_key"
    ON "CreditTransaction"("businessId", "transactionNumber");
CREATE UNIQUE INDEX "CreditTransaction_businessId_id_key"
    ON "CreditTransaction"("businessId", "id");
CREATE UNIQUE INDEX "CreditTransaction_businessId_idempotencyKey_key"
    ON "CreditTransaction"("businessId", "idempotencyKey");
CREATE INDEX "CreditTransaction_businessId_customerId_transactionDate_idx"
    ON "CreditTransaction"("businessId", "customerId", "transactionDate");
CREATE INDEX "CreditTransaction_businessId_status_dueDate_idx"
    ON "CreditTransaction"("businessId", "status", "dueDate");
CREATE INDEX "CreditTransaction_customerId_dueDate_idx"
    ON "CreditTransaction"("customerId", "dueDate");

ALTER TABLE "CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_businessId_customerId_fkey"
    FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_reversedById_fkey"
    FOREIGN KEY ("reversedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_correctionOfId_fkey"
    FOREIGN KEY ("correctionOfId") REFERENCES "CreditTransaction"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canonical immutable payment records.
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "paymentNumber" VARCHAR(64) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethodV2" NOT NULL,
    "reference" VARCHAR(120),
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "status" "FinancialStatus" NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" VARCHAR(191),
    "correctionOfId" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "Payment_businessId_paymentNumber_key"
    ON "Payment"("businessId", "paymentNumber");
CREATE UNIQUE INDEX "Payment_businessId_id_key" ON "Payment"("businessId", "id");
CREATE UNIQUE INDEX "Payment_businessId_idempotencyKey_key"
    ON "Payment"("businessId", "idempotencyKey");
CREATE INDEX "Payment_businessId_customerId_paymentDate_idx"
    ON "Payment"("businessId", "customerId", "paymentDate");
CREATE INDEX "Payment_businessId_status_paymentDate_idx"
    ON "Payment"("businessId", "status", "paymentDate");
CREATE INDEX "Payment_businessId_reference_idx" ON "Payment"("businessId", "reference");

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_businessId_customerId_fkey"
    FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_reversedById_fkey"
    FOREIGN KEY ("reversedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_correctionOfId_fkey"
    FOREIGN KEY ("correctionOfId") REFERENCES "Payment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level guardrail: application code may change a financial row only to
-- reverse/cancel it and record who/when/why. Amount, customer, date, references,
-- and descriptive history cannot be overwritten after insertion.
CREATE FUNCTION "kidaftari_preserve_financial_record"()
RETURNS TRIGGER AS $$
BEGIN
    IF (to_jsonb(NEW) - ARRAY['status', 'reversedAt', 'reversedById', 'reversalReason', 'updatedAt'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'reversedAt', 'reversedById', 'reversalReason', 'updatedAt']) THEN
        RAISE EXCEPTION 'Financial records are immutable. Create a correction or reversal instead.';
    END IF;

    IF OLD."status" <> 'ACTIVE'::"FinancialStatus" THEN
        RAISE EXCEPTION 'A reversed or cancelled financial record cannot be changed.';
    END IF;

    IF NEW."status" = 'ACTIVE'::"FinancialStatus" AND (
        NEW."reversedAt" IS DISTINCT FROM OLD."reversedAt"
        OR NEW."reversedById" IS DISTINCT FROM OLD."reversedById"
        OR NEW."reversalReason" IS DISTINCT FROM OLD."reversalReason"
    ) THEN
        RAISE EXCEPTION 'Reversal metadata requires a REVERSED or CANCELLED status.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

CREATE TRIGGER "CreditTransaction_preserve_history"
BEFORE UPDATE ON "CreditTransaction"
FOR EACH ROW EXECUTE FUNCTION "kidaftari_preserve_financial_record"();

CREATE TRIGGER "Payment_preserve_history"
BEFORE UPDATE ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "kidaftari_preserve_financial_record"();

-- Durable scheduled reminders.
CREATE TABLE "Reminder" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "creditTransactionId" UUID,
    "kind" "ReminderKindV2" NOT NULL DEFAULT 'DUE_TODAY',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" "ReminderStatusV2" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "failureReason" TEXT,
    "idempotencyKey" VARCHAR(191) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Reminder_idempotencyKey_key" ON "Reminder"("idempotencyKey");
CREATE UNIQUE INDEX "Reminder_businessId_id_key" ON "Reminder"("businessId", "id");
CREATE INDEX "Reminder_status_scheduledAt_idx" ON "Reminder"("status", "scheduledAt");
CREATE INDEX "Reminder_businessId_customerId_scheduledAt_idx"
    ON "Reminder"("businessId", "customerId", "scheduledAt");
CREATE INDEX "Reminder_businessId_creditTransactionId_idx"
    ON "Reminder"("businessId", "creditTransactionId");

ALTER TABLE "Reminder"
    ADD CONSTRAINT "Reminder_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reminder"
    ADD CONSTRAINT "Reminder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reminder"
    ADD CONSTRAINT "Reminder_businessId_customerId_fkey"
    FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reminder"
    ADD CONSTRAINT "Reminder_creditTransactionId_fkey"
    FOREIGN KEY ("creditTransactionId") REFERENCES "CreditTransaction"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reminder"
    ADD CONSTRAINT "Reminder_businessId_creditTransactionId_fkey"
    FOREIGN KEY ("businessId", "creditTransactionId") REFERENCES "CreditTransaction"("businessId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reminder"
    ADD CONSTRAINT "Reminder_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Provider-neutral SMS records. This uses a V2 table so no old provider log is
-- dropped while history is preserved and backfilled below.
CREATE TABLE "SmsMessageV2" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID,
    "creditTransactionId" UUID,
    "paymentId" UUID,
    "reminderId" UUID,
    "type" "SmsType" NOT NULL,
    "phoneNumber" VARCHAR(32) NOT NULL,
    "message" TEXT NOT NULL,
    "provider" "SmsProvider" NOT NULL DEFAULT 'MOCK',
    "providerMessageId" VARCHAR(191),
    "status" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "cost" INTEGER,
    "idempotencyKey" VARCHAR(191) NOT NULL,
    "senderId" VARCHAR(32),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsMessageV2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SmsMessageV2_cost_nonnegative" CHECK ("cost" IS NULL OR "cost" >= 0)
);

CREATE UNIQUE INDEX "SmsMessageV2_reminderId_key" ON "SmsMessageV2"("reminderId");
CREATE UNIQUE INDEX "SmsMessageV2_idempotencyKey_key" ON "SmsMessageV2"("idempotencyKey");
CREATE UNIQUE INDEX "SmsMessageV2_provider_providerMessageId_key"
    ON "SmsMessageV2"("provider", "providerMessageId");
CREATE INDEX "SmsMessageV2_status_scheduledAt_idx" ON "SmsMessageV2"("status", "scheduledAt");
CREATE INDEX "SmsMessageV2_businessId_customerId_createdAt_idx"
    ON "SmsMessageV2"("businessId", "customerId", "createdAt");
CREATE INDEX "SmsMessageV2_businessId_creditTransactionId_idx"
    ON "SmsMessageV2"("businessId", "creditTransactionId");
CREATE INDEX "SmsMessageV2_businessId_paymentId_idx"
    ON "SmsMessageV2"("businessId", "paymentId");

ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_businessId_customerId_fkey"
    FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id")
    ON DELETE SET NULL ("customerId") ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_creditTransactionId_fkey"
    FOREIGN KEY ("creditTransactionId") REFERENCES "CreditTransaction"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_businessId_creditTransactionId_fkey"
    FOREIGN KEY ("businessId", "creditTransactionId") REFERENCES "CreditTransaction"("businessId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_businessId_paymentId_fkey"
    FOREIGN KEY ("businessId", "paymentId") REFERENCES "Payment"("businessId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_reminderId_fkey"
    FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_businessId_reminderId_fkey"
    FOREIGN KEY ("businessId", "reminderId") REFERENCES "Reminder"("businessId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessageV2"
    ADD CONSTRAINT "SmsMessageV2_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill every pre-existing original financial entry into its canonical table.
-- Reversal rows remain untouched in LedgerEntry and mark the matching original
-- canonical row as REVERSED, including the original reversal actor/reason.
INSERT INTO "CreditTransaction" (
    "id", "businessId", "customerId", "transactionNumber", "description",
    "amount", "transactionDate", "dueDate", "status", "idempotencyKey",
    "reversedAt", "reversedById", "reversalReason", "createdById", "createdAt", "updatedAt"
)
SELECT
    entry."id",
    entry."businessId",
    entry."customerId",
    'CR-' || upper(replace(entry."id"::text, '-', '')),
    entry."description",
    entry."amountTzs",
    entry."occurredAt",
    entry."dueDate",
    CASE WHEN reversal."id" IS NULL THEN 'ACTIVE'::"FinancialStatus" ELSE 'REVERSED'::"FinancialStatus" END,
    entry."idempotencyKey",
    reversal."createdAt",
    reversal."createdById",
    reversal."reversalReason",
    entry."createdById",
    entry."createdAt",
    COALESCE(reversal."createdAt", entry."createdAt")
FROM "LedgerEntry" AS entry
LEFT JOIN "LedgerEntry" AS reversal
    ON reversal."reversalOfId" = entry."id" AND reversal."type" = 'CREDIT_REVERSAL'
WHERE entry."type" = 'CREDIT'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Payment" (
    "id", "businessId", "customerId", "paymentNumber", "amount", "paymentMethod",
    "reference", "paymentDate", "notes", "status", "idempotencyKey", "reversedAt",
    "reversedById", "reversalReason", "createdById", "createdAt", "updatedAt"
)
SELECT
    entry."id",
    entry."businessId",
    entry."customerId",
    'PM-' || upper(replace(entry."id"::text, '-', '')),
    entry."amountTzs",
    CASE
        WHEN entry."paymentMethod" = 'CASH' THEN 'CASH'::"PaymentMethodV2"
        WHEN entry."paymentMethod" = 'MOBILE_MONEY' THEN 'MOBILE_MONEY'::"PaymentMethodV2"
        WHEN entry."paymentMethod" IN ('BANK_TRANSFER', 'CARD') THEN 'BANK'::"PaymentMethodV2"
        ELSE 'OTHER'::"PaymentMethodV2"
    END,
    entry."paymentReference",
    entry."occurredAt",
    entry."description",
    CASE WHEN reversal."id" IS NULL THEN 'ACTIVE'::"FinancialStatus" ELSE 'REVERSED'::"FinancialStatus" END,
    entry."idempotencyKey",
    reversal."createdAt",
    reversal."createdById",
    reversal."reversalReason",
    entry."createdById",
    entry."createdAt",
    COALESCE(reversal."createdAt", entry."createdAt")
FROM "LedgerEntry" AS entry
LEFT JOIN "LedgerEntry" AS reversal
    ON reversal."reversalOfId" = entry."id" AND reversal."type" = 'PAYMENT_REVERSAL'
WHERE entry."type" = 'PAYMENT'
ON CONFLICT ("id") DO NOTHING;

-- Backfill reminder jobs. A legacy PROCESSING row can safely resume as PENDING;
-- a skipped row becomes CANCELLED without modifying the historical source row.
INSERT INTO "Reminder" (
    "id", "businessId", "customerId", "creditTransactionId", "kind", "scheduledAt",
    "sentAt", "status", "message", "failureReason", "idempotencyKey", "createdById",
    "createdAt", "updatedAt"
)
SELECT
    schedule."id",
    schedule."businessId",
    schedule."customerId",
    credit."id",
    schedule."kind"::text::"ReminderKindV2",
    schedule."scheduledFor",
    CASE WHEN schedule."status" = 'SENT' THEN schedule."completedAt" ELSE NULL END,
    CASE
        WHEN schedule."status" IN ('PENDING', 'PROCESSING') THEN 'PENDING'::"ReminderStatusV2"
        WHEN schedule."status" = 'SENT' THEN 'SENT'::"ReminderStatusV2"
        WHEN schedule."status" = 'FAILED' THEN 'FAILED'::"ReminderStatusV2"
        ELSE 'CANCELLED'::"ReminderStatusV2"
    END,
    COALESCE(legacy_sms."body", 'Payment reminder from KIDAFTARI.'),
    COALESCE(schedule."skippedReason", legacy_sms."errorMessage"),
    schedule."idempotencyKey",
    schedule."createdById",
    schedule."createdAt",
    schedule."updatedAt"
FROM "ReminderSchedule" AS schedule
LEFT JOIN "CreditTransaction" AS credit ON credit."id" = schedule."ledgerEntryId"
LEFT JOIN "SmsMessage" AS legacy_sms ON legacy_sms."reminderId" = schedule."id"
ON CONFLICT ("id") DO NOTHING;

-- Backfill existing SMS logs into the provider-neutral V2 table.
INSERT INTO "SmsMessageV2" (
    "id", "businessId", "customerId", "creditTransactionId", "paymentId", "reminderId",
    "type", "phoneNumber", "message", "provider", "providerMessageId", "status", "cost",
    "idempotencyKey", "senderId", "attemptCount", "scheduledAt", "lastAttemptAt", "sentAt",
    "failureReason", "createdById", "createdAt", "updatedAt"
)
SELECT
    legacy."id",
    legacy."businessId",
    legacy."customerId",
    credit."id",
    payment."id",
    reminder."id",
    CASE
        WHEN legacy."kind" = 'PAYMENT_CONFIRMATION' THEN 'PAYMENT_CONFIRMATION'::"SmsType"
        WHEN legacy."kind" = 'CREDIT_CONFIRMATION' THEN 'CREDIT_CREATED'::"SmsType"
        WHEN legacy."kind" = 'REMINDER' THEN 'REMINDER'::"SmsType"
        ELSE 'OTHER'::"SmsType"
    END,
    legacy."toPhone",
    legacy."body",
    legacy."provider",
    legacy."providerMessageId",
    legacy."status",
    NULL,
    legacy."idempotencyKey",
    legacy."senderId",
    legacy."attemptCount",
    legacy."scheduledFor",
    legacy."lastAttemptAt",
    legacy."sentAt",
    legacy."errorMessage",
    legacy."createdById",
    legacy."createdAt",
    legacy."updatedAt"
FROM "SmsMessage" AS legacy
LEFT JOIN "CreditTransaction" AS credit ON credit."id" = legacy."ledgerEntryId"
LEFT JOIN "Payment" AS payment ON payment."id" = legacy."ledgerEntryId"
LEFT JOIN "Reminder" AS reminder ON reminder."id" = legacy."reminderId"
ON CONFLICT ("id") DO NOTHING;

-- All access goes through the trusted Prisma server and its tenant checks.
-- No Data API policies are created: browser roles must not access these tables.
DO $$
DECLARE
    table_name text;
    api_role text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['CreditTransaction', 'Payment', 'Reminder', 'SmsMessageV2'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
        FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
            END IF;
        END LOOP;
    END LOOP;
    REVOKE ALL ON FUNCTION public.kidaftari_preserve_financial_record() FROM PUBLIC;
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.kidaftari_preserve_financial_record() FROM %I', api_role);
        END IF;
    END LOOP;
END $$;
