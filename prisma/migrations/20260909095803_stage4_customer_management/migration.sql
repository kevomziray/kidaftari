-- Stage 4 assigns readable customer numbers per business. The business row is
-- updated inside the customer-create transaction, so concurrent registrations
-- cannot receive the same number.
ALTER TABLE "Business"
  ADD COLUMN "nextCustomerNumber" INTEGER NOT NULL DEFAULT 1;

UPDATE "Business" AS business
SET "nextCustomerNumber" = GREATEST(
  1,
  COALESCE(
    (
      SELECT MAX(SUBSTRING(customer."customerNumber" FROM 5)::INTEGER) + 1
      FROM "Customer" AS customer
      WHERE customer."businessId" = business.id
        AND customer."customerNumber" ~ '^KDF-[0-9]{6}$'
    ),
    1
  )
);

ALTER TABLE "Business"
  ADD CONSTRAINT "Business_nextCustomerNumber_positive"
  CHECK ("nextCustomerNumber" BETWEEN 1 AND 1000000);
