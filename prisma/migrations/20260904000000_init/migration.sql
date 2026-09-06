-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'SW');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'VIEWER');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDIT', 'PAYMENT', 'CREDIT_REVERSAL', 'PAYMENT_REVERSAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmsProvider" AS ENUM ('MOCK', 'BEEM', 'AFRICAS_TALKING', 'TWILIO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmsKind" AS ENUM ('REMINDER', 'PAYMENT_CONFIRMATION', 'CREDIT_CONFIRMATION', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32),
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "address" TEXT,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "currency" CHAR(3) NOT NULL DEFAULT 'TZS',
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultCreditDueDays" INTEGER NOT NULL DEFAULT 7,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBeforeDue" INTEGER NOT NULL DEFAULT 1,
    "overdueReminderIntervalDays" INTEGER NOT NULL DEFAULT 7,
    "reminderLocalTime" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "sendPaymentConfirmations" BOOLEAN NOT NULL DEFAULT true,
    "allowCustomerOverpayments" BOOLEAN NOT NULL DEFAULT false,
    "smsSenderId" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMembership" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'CASHIER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32),
    "phoneE164" VARCHAR(20),
    "email" VARCHAR(320),
    "address" TEXT,
    "notes" TEXT,
    "defaultDueDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amountTzs" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE,
    "description" TEXT,
    "paymentMethod" "PaymentMethod",
    "paymentReference" VARCHAR(120),
    "idempotencyKey" VARCHAR(191),
    "reversalOfId" UUID,
    "reversalReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSchedule" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "ledgerEntryId" UUID,
    "kind" "ReminderKind" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "balanceSnapshotTzs" INTEGER,
    "language" "Locale" NOT NULL DEFAULT 'EN',
    "idempotencyKey" VARCHAR(191) NOT NULL,
    "skippedReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID,
    "ledgerEntryId" UUID,
    "reminderId" UUID,
    "kind" "SmsKind" NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" "SmsProvider" NOT NULL DEFAULT 'MOCK',
    "providerMessageId" VARCHAR(191),
    "idempotencyKey" VARCHAR(191) NOT NULL,
    "toPhone" VARCHAR(32) NOT NULL,
    "senderId" VARCHAR(32),
    "body" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(191),
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "requestId" VARCHAR(100),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "Business_isActive_idx" ON "Business"("isActive");
CREATE INDEX "BusinessMembership_userId_isActive_idx" ON "BusinessMembership"("userId", "isActive");
CREATE INDEX "BusinessMembership_businessId_role_isActive_idx" ON "BusinessMembership"("businessId", "role", "isActive");
CREATE UNIQUE INDEX "BusinessMembership_businessId_userId_key" ON "BusinessMembership"("businessId", "userId");
CREATE INDEX "Customer_businessId_fullName_idx" ON "Customer"("businessId", "fullName");
CREATE INDEX "Customer_businessId_phoneE164_idx" ON "Customer"("businessId", "phoneE164");
CREATE INDEX "Customer_businessId_isActive_idx" ON "Customer"("businessId", "isActive");
CREATE UNIQUE INDEX "LedgerEntry_reversalOfId_key" ON "LedgerEntry"("reversalOfId");
CREATE INDEX "LedgerEntry_businessId_customerId_occurredAt_idx" ON "LedgerEntry"("businessId", "customerId", "occurredAt");
CREATE INDEX "LedgerEntry_businessId_type_occurredAt_idx" ON "LedgerEntry"("businessId", "type", "occurredAt");
CREATE INDEX "LedgerEntry_customerId_dueDate_idx" ON "LedgerEntry"("customerId", "dueDate");
CREATE INDEX "LedgerEntry_businessId_paymentReference_idx" ON "LedgerEntry"("businessId", "paymentReference");
CREATE UNIQUE INDEX "LedgerEntry_businessId_idempotencyKey_key" ON "LedgerEntry"("businessId", "idempotencyKey");
CREATE UNIQUE INDEX "ReminderSchedule_idempotencyKey_key" ON "ReminderSchedule"("idempotencyKey");
CREATE INDEX "ReminderSchedule_status_scheduledFor_idx" ON "ReminderSchedule"("status", "scheduledFor");
CREATE INDEX "ReminderSchedule_businessId_customerId_scheduledFor_idx" ON "ReminderSchedule"("businessId", "customerId", "scheduledFor");
CREATE INDEX "ReminderSchedule_ledgerEntryId_kind_idx" ON "ReminderSchedule"("ledgerEntryId", "kind");
CREATE UNIQUE INDEX "SmsMessage_reminderId_key" ON "SmsMessage"("reminderId");
CREATE UNIQUE INDEX "SmsMessage_idempotencyKey_key" ON "SmsMessage"("idempotencyKey");
CREATE INDEX "SmsMessage_status_scheduledFor_idx" ON "SmsMessage"("status", "scheduledFor");
CREATE INDEX "SmsMessage_businessId_customerId_createdAt_idx" ON "SmsMessage"("businessId", "customerId", "createdAt");
CREATE INDEX "SmsMessage_ledgerEntryId_idx" ON "SmsMessage"("ledgerEntryId");
CREATE UNIQUE INDEX "SmsMessage_provider_providerMessageId_key" ON "SmsMessage"("provider", "providerMessageId");
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");
CREATE INDEX "AuditLog_businessId_entityType_entityId_idx" ON "AuditLog"("businessId", "entityType", "entityId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReminderSchedule" ADD CONSTRAINT "ReminderSchedule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReminderSchedule" ADD CONSTRAINT "ReminderSchedule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReminderSchedule" ADD CONSTRAINT "ReminderSchedule_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReminderSchedule" ADD CONSTRAINT "ReminderSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "ReminderSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- KIDAFTARI uses server-side Prisma sessions, not the Supabase browser Data API.
-- Deny browser roles access, including to credentials and session token hashes.
-- Role checks keep this migration compatible with ordinary PostgreSQL as well.
DO $$
DECLARE
    table_name text;
    api_role text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'User', 'UserSession', 'PasswordResetToken', 'Business',
        'BusinessMembership', 'Customer', 'LedgerEntry', 'ReminderSchedule',
        'SmsMessage', 'AuditLog'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
        FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
            END IF;
        END LOOP;
    END LOOP;
END $$;
