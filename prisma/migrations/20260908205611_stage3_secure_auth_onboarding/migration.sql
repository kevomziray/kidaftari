-- Stage 3 adds application-managed authentication onboarding and persistent
-- login throttles. Existing businesses are marked complete so this additive
-- migration does not interrupt current owners or staff.

ALTER TABLE "Business"
  ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMPTZ(3);

UPDATE "Business"
SET "onboardingStep" = 5,
    "onboardingCompletedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "User"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "canReverseTransactions" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "User_identifier_check" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

CREATE TABLE "AuthRateLimit" (
  "key" VARCHAR(64) NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "AuthRateLimit_count_check" CHECK ("count" > 0)
);

CREATE INDEX "AuthRateLimit_resetAt_idx" ON "AuthRateLimit"("resetAt");

ALTER TABLE "AuthRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AuthRateLimit" FROM anon, authenticated;
