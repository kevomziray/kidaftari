-- Read-only Stage 2 relationship and access checks. All mismatch/grant counts should be zero.
SELECT
 (SELECT count(*) FROM public."CreditTransaction" cr JOIN public."Customer" c ON c."id"=cr."customerId" WHERE cr."businessId"<>c."businessId") AS credit_tenant_mismatches,
 (SELECT count(*) FROM public."Payment" p JOIN public."Customer" c ON c."id"=p."customerId" WHERE p."businessId"<>c."businessId") AS payment_tenant_mismatches,
 (SELECT count(*) FROM public."Reminder" r JOIN public."Customer" c ON c."id"=r."customerId" LEFT JOIN public."CreditTransaction" cr ON cr."id"=r."creditTransactionId" WHERE r."businessId"<>c."businessId" OR r."businessId"<>cr."businessId" OR r."customerId"<>cr."customerId") AS reminder_relationship_mismatches,
 (SELECT count(*) FROM public."SmsMessageV2" s LEFT JOIN public."Customer" c ON c."id"=s."customerId" LEFT JOIN public."CreditTransaction" cr ON cr."id"=s."creditTransactionId" LEFT JOIN public."Payment" p ON p."id"=s."paymentId" LEFT JOIN public."Reminder" r ON r."id"=s."reminderId" WHERE s."businessId"<>c."businessId" OR s."businessId"<>cr."businessId" OR s."businessId"<>p."businessId" OR s."businessId"<>r."businessId" OR s."customerId"<>cr."customerId" OR s."customerId"<>p."customerId" OR s."customerId"<>r."customerId") AS sms_relationship_mismatches,
 (SELECT count(*) FROM public."AuditLog" a JOIN public."User" u ON u."id"=a."actorId" WHERE a."businessId"<>u."businessId") AS audit_actor_tenant_mismatches,
 (SELECT count(*) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relkind='r') AS public_tables,
 (SELECT count(*) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relkind='r' AND NOT t.relrowsecurity) AS tables_without_rls,
 (SELECT count(*) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace CROSS JOIN (VALUES ('anon'),('authenticated')) roles(name) WHERE n.nspname='public' AND t.relkind='r' AND has_table_privilege(roles.name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS browser_role_table_grants,
 (SELECT count(*) FROM public."CreditTransaction" WHERE "status"='REVERSED' AND "reversedById" IS NOT NULL AND "reversedAt" IS NOT NULL AND "reversalReason" IS NOT NULL) AS preserved_credit_reversals,
 (SELECT count(*) FROM public."Payment" WHERE "status"='CANCELLED' AND "reversedById" IS NOT NULL AND "reversedAt" IS NOT NULL AND "reversalReason" IS NOT NULL) AS preserved_payment_cancellations;

