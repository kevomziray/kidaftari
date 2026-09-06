# Stage 2 development database verification

The approved Stage 2 migrations and demo shop are deployed to the Kidaftari development Supabase project, `enzhzvrkagyxqewevnab`.

## Deployment

- Supabase migration `20260905125825_kidaftari_init` applies `prisma/migrations/20260904000000_init/migration.sql`.
- Supabase migration `20260905125836_kidaftari_stage2_credit_foundation` applies `prisma/migrations/20260905000000_stage2_credit_foundation/migration.sql`.
- Supabase migration `20260905125921_kidaftari_prisma_migration_history` records the two local migration names and exact SHA-256 checksums in `public._prisma_migrations`. This allows subsequent Prisma deployments to recognize the completed migrations.
- Migration checksums: initial `a0f6ab8d7c54d80d85583441f520976b35b649ccb494bc2e5e75723a7c2989bc`; Stage 2 `488a2caa5f6056ba3f0b8dac4aaf1d3fa0b950ae4d7748db13d8b5070e7b4df1`.
- The seed SQL was generated from the existing `prisma/seed.ts` fixtures using Prisma's field and table mappings. It inserted 17 records in one transaction, with conflict handling that leaves existing records unchanged. A second run confirmed the same counts and balance.

The migrations and seed were executed through Supabase MCP because the local Windows Prisma connection was unavailable. No database credentials were copied into these documents.

## Verified data

| Record                             | Count |
| ---------------------------------- | ----: |
| Demo business                      |     1 |
| Users (one owner, one staff)       |     2 |
| Customers                          |     4 |
| Credits (including one reversed)   |     4 |
| Payments (including one cancelled) |     3 |
| Reminder                           |     1 |
| Queued mock SMS                    |     1 |
| Seed audit event                   |     1 |

Active credits total TZS 155,000. Active payments total TZS 45,000. Outstanding balance is **TZS 110,000**.

| Customer    | Outstanding TZS |
| ----------- | --------------: |
| Asha Mrema  |          35,000 |
| Baraka Juma |               0 |
| Juma Hassan |               0 |
| Neema Kweka |          75,000 |

## Verification results

- No mismatched business/customer relationships in credits or payments.
- No mismatched reminder/customer/credit relationships.
- No mismatched SMS/customer/credit/payment/reminder relationships.
- No mismatched audit actor tenant.
- Reversed credit and cancelled payment retain actor, date, and reason.
- All 15 public tables, including Prisma migration history, have RLS enabled.
- Neither `anon` nor `authenticated` has table privileges on those tables.
- Six rollback-only checks passed: cross-tenant credit and payment inserts rejected; negative credit and zero payment amounts rejected; edits to existing credit and payment amounts rejected.
- Temporary guardrail-test records were rolled back; the demo still has one business and 17 records.
- Supabase Security Advisor returned no warning or error findings. Its 15 informational [RLS Enabled No Policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) are expected: access uses trusted server-side Prisma sessions, with browser Data API access denied.
- No live SMS was sent; the seeded message uses the MOCK provider.

## Local preview limitation

The database checks above passed directly against Supabase. The local `node --import tsx prisma/verify.ts` command could not run: Windows sandbox execution failed at `uv_os_get_passwd`, and automatic approval review rejected the request to run that read-only command outside the sandbox because the review service reported a usage limit. Earlier local Prisma connection checks also failed. End-to-end local sign-in and preview therefore remain unverified.

Once the local runtime and database connection work, use `pnpm db:verify` and sign in with the development credentials in the main README. The Supabase migration and seed do not need to be repeated.

## Reusable SQL checks

- `prisma/verify-relationships.sql` is read-only and reports relationship and access-control counts.
- `prisma/verify-guardrails.sql` intentionally attempts invalid writes inside a transaction and ends with ROLLBACK. It requires the demo fixtures and a trusted database connection.
