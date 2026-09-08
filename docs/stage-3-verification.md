# Stage 3 development verification

Stage 3 secure authentication and onboarding is deployed to the Kidaftari development Supabase project, `enzhzvrkagyxqewevnab`.

## Deployment

- Supabase migration `20260908210402_kidaftari_stage3_secure_auth_onboarding` applies `prisma/migrations/20260908205611_stage3_secure_auth_onboarding/migration.sql`.
- Supabase migration `20260908210514_kidaftari_stage3_prisma_migration_history` records the local migration in `public._prisma_migrations`.
- The local migration SHA-256 checksum is `c50c60872eafca6eb938fbadb1e6091daedbef05fa19e1a3a8c2259304c24fd5`, matching the deployed Prisma history row.
- The migration is additive. It makes user email optional, adds globally unique user phone login, an explicit staff reversal flag, onboarding progress, and the persistent `AuthRateLimit` table.
- Existing businesses were marked onboarded so the migration does not interrupt current users. New businesses begin at onboarding step 1.

## Security behavior

- Registration validates and normalizes a Tanzanian phone number or email, hashes passwords with bcrypt cost 12, and atomically creates the Business, OWNER User, audit event, and hashed server session.
- Login accepts phone or email, uses a generic credential error, performs password work for unknown accounts, rotates the active session, and applies shared Postgres throttles by identifier and account.
- Session cookies are HttpOnly, SameSite=Lax, Secure in production, idle-expiring after 24 hours, and absolutely expiring after 7 days. Only SHA-256 token hashes are stored.
- Every protected route reloads the active user, role, reversal permission, and business from the database. Client cookies and submitted business IDs cannot choose the tenant.
- OWNER has all Stage 3 capabilities. STAFF can view/add customers, record credit/payments, and view transaction history. Reversal requires an explicit owner grant; settings, reports, reminders/SMS, staff management, ownership, and customer archiving remain owner-only.
- Staff access changes revoke that user's active sessions.
- Cross-site Server Action requests are rejected against `APP_ORIGIN`.

## Verification results

- `pnpm test`: 21 authentication, session, permission, onboarding-order, and tenant-isolation tests passed.
- `pnpm typecheck`, `pnpm lint`, `pnpm db:validate`, `pnpm format`, `pnpm build`, and `git diff --check` passed.
- Registration and login forms were rendered and visually checked in the local browser at desktop width.
- The rate-limit upsert incremented atomically from 1 to 2 in development; the temporary verification row was deleted.
- Database counts remain one business, two users, four customers, four credits, and three payments.
- Active credits remain TZS 155,000; active payments remain TZS 45,000; outstanding balance remains TZS 110,000.
- No user lacks both phone and email. Both existing password hashes are valid bcrypt cost-12 hashes. Staff reversal grants remain off by default.
- All tenant relationship mismatch counts remain zero. The reversed credit and cancelled payment audit details remain preserved.
- All 16 public tables have RLS enabled and browser roles have no table grants. `AuthRateLimit` also has RLS with no browser access.
- Supabase Security Advisor returned no warning or error findings. Its informational “RLS Enabled No Policy” notices are expected because KIDAFTARI uses a trusted server-side Prisma connection and denies browser Data API access.
- Supabase Performance Advisor returned informational findings inherited from the Stage 2 schema plus a new unused-index notice for the freshly created rate-limit expiry index. No warning or error finding was returned.

## Current local limitation

The configured local Prisma connection still cannot reach the Supabase pooler on port 5432, so registration, login, logout, onboarding submission, and authenticated pages could not be exercised end to end through this workstation. The production build and mocked server-action tests passed, and the migration/data checks passed directly against Supabase. After fixing the ignored local `.env` connection string, follow [Stage 3 testing](stage-3-testing.md) for manual end-to-end checks.

No live SMS was sent and no production deployment was performed.
