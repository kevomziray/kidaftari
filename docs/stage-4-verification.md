# Stage 4 development verification

Stage 4 customer management is deployed to the Kidaftari development Supabase project, **enzhzvrkagyxqewevnab**.

## Deployment

- Supabase migration **20260909103236_kidaftari_stage4_customer_management** applies **prisma/migrations/20260909095803_stage4_customer_management/migration.sql**.
- Supabase migration **20260909103302_kidaftari_stage4_prisma_migration_history** records the local migration in **public.\_prisma_migrations**.
- The local and deployed Prisma checksum is **d37de598e805453b2f838ebc02d03ae10278e387c587388d1e7ce6276780a5fb**.
- The additive migration adds only **Business.nextCustomerNumber**, initializes it from existing KDF customer numbers, and constrains it to the supported six-digit range.
- The application increments the business counter and creates the customer inside one transaction, producing sequential numbers such as **KDF-000001** without trusting browser tenant input.

## Customer behavior

- The active customer list shows name, phone, outstanding balance, status, last transaction, and actions.
- Search covers name, customer number, Tanzania local phone format, 255 format, and +255 format.
- Filters cover all customers, positive balances, paid accounts, due soon/due today, and overdue accounts.
- Create and edit validate Tanzania mobile numbers and store normalized +255 values.
- Customer profiles show the requested totals and dates. Payments are allocated to the oldest active credits first when identifying the oldest outstanding credit and next due date.
- Transaction history includes a running balance. Reversed records remain visible but do not affect totals.
- Deactivation keeps the customer and every financial transaction. New credit/payment actions already reject inactive customers.
- Owners can edit, deactivate, send reminders, and reverse transactions. Staff can view and add customers and view/record financial activity, while owner-only customer actions remain unavailable.
- Customer language is used for payment confirmations and reminders. Disabling reminders also cancels queued automatic reminders when the worker reaches them.

## Verification results

- **pnpm test:** 30 tests passed across customer creation, Tanzania phone validation, search, filters, edit scoping, profile tenant isolation, deactivation, FIFO summary calculations, running balances, authentication, and role permissions.
- **pnpm typecheck**, **pnpm lint**, **pnpm db:validate**, **pnpm format**, **pnpm build**, and **git diff --check** passed.
- The production build includes **/customers**, **/customers/new**, **/customers/[customerId]**, **/customers/[customerId]/edit**, and **/customers/[customerId]/statement**.
- Development data remains one business, two users, four customers, four credits, and three payments.
- Active credit remains TZS 155,000; active payments remain TZS 45,000; outstanding remains TZS 110,000.
- The existing demo business counter is 1 because its preserved fixture numbers use the older **CUS-DEMO** format; its first new Stage 4 customer will receive **KDF-000001**.
- Financial-to-customer tenant mismatch count remains zero.
- All 16 public tables have RLS enabled and the anon/authenticated browser roles have zero table grants.
- Supabase Security Advisor returned only the expected informational **RLS Enabled No Policy** notices. KIDAFTARI uses a trusted server-side Prisma connection and deliberately denies browser Data API access. See [Supabase lint 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Supabase Performance Advisor returned informational inherited foreign-key and unused-index notices; it returned no warning or error finding. See [Supabase lint 0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Local verification note

The production build and all test suites completed. The separate **pnpm db:verify** script could not start because the local Node 24/tsx process returned **uv_os_get_passwd ENOMEM**; the same database counts, balances, migration checksum, constraint, grants, and tenant relationships were verified directly against the development Supabase project.

No live SMS was sent and no production deployment was performed.
