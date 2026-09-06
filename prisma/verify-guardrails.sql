-- Development demo guardrails. Requires the seed and always rolls back its test writes.
BEGIN;
DO $$
DECLARE
 test_business uuid := gen_random_uuid();
 blocked boolean;
 blocked_constraint text;
BEGIN
 INSERT INTO public."Business" ("id","name","updatedAt")
 VALUES (test_business,'Temporary relationship verification',now());

 blocked := false;
 BEGIN
  INSERT INTO public."CreditTransaction" ("id","businessId","customerId","transactionNumber","amount","updatedAt")
  VALUES (gen_random_uuid(),test_business,'10000000-0000-4000-8000-000000000101','VERIFY-CROSS-TENANT',1,now());
 EXCEPTION WHEN foreign_key_violation THEN
  GET STACKED DIAGNOSTICS blocked_constraint = CONSTRAINT_NAME;
  blocked := blocked_constraint = 'CreditTransaction_businessId_customerId_fkey';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Credit cross-tenant protection failed'; END IF;

 blocked := false;
 BEGIN
  INSERT INTO public."Payment" ("id","businessId","customerId","paymentNumber","paymentMethod","amount","updatedAt")
  VALUES (gen_random_uuid(),test_business,'10000000-0000-4000-8000-000000000101','VERIFY-CROSS-TENANT','CASH',1,now());
 EXCEPTION WHEN foreign_key_violation THEN
  GET STACKED DIAGNOSTICS blocked_constraint = CONSTRAINT_NAME;
  blocked := blocked_constraint = 'Payment_businessId_customerId_fkey';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Payment cross-tenant protection failed'; END IF;

 blocked := false;
 BEGIN
  INSERT INTO public."CreditTransaction" ("id","businessId","customerId","transactionNumber","amount","updatedAt")
  VALUES (gen_random_uuid(),'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000101','VERIFY-NEGATIVE',-1,now());
 EXCEPTION WHEN check_violation THEN
  GET STACKED DIAGNOSTICS blocked_constraint = CONSTRAINT_NAME;
  blocked := blocked_constraint = 'CreditTransaction_amount_positive';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Positive-credit-amount protection failed'; END IF;

 blocked := false;
 BEGIN
  INSERT INTO public."Payment" ("id","businessId","customerId","paymentNumber","paymentMethod","amount","updatedAt")
  VALUES (gen_random_uuid(),'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000101','VERIFY-ZERO','CASH',0,now());
 EXCEPTION WHEN check_violation THEN
  GET STACKED DIAGNOSTICS blocked_constraint = CONSTRAINT_NAME;
  blocked := blocked_constraint = 'Payment_amount_positive';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Positive-payment-amount protection failed'; END IF;

 blocked := false;
 BEGIN
  UPDATE public."CreditTransaction" SET "amount"="amount"+1 WHERE "id"='10000000-0000-4000-8000-000000000201';
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Credit history protection failed'; END IF;

 blocked := false;
 BEGIN
  UPDATE public."Payment" SET "amount"="amount"+1 WHERE "id"='10000000-0000-4000-8000-000000000301';
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Payment history protection failed'; END IF;
END $$;
SELECT 'PASS: six financial guardrail checks; all test changes rolled back' AS verification;
ROLLBACK;

