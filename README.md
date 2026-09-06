# KIDAFTARI

**Your Digital Credit Notebook** — a simple, mobile-first credit notebook for Tanzanian businesses.

Stage 2 adds the secure PostgreSQL/Prisma foundation: tenant-scoped businesses and users, customers, immutable credit and payment records, reminders, provider-neutral SMS logs, audit trails, a development seed, and server-only balance/history helpers.

## Technology

- Next.js App Router + TypeScript
- Tailwind CSS
- PostgreSQL + Prisma ORM
- ESLint + Prettier
- Tanzania defaults: `Africa/Dar_es_Salaam` and `TZS`

## Project structure

```text
app/           Routes, layouts, server actions, loading/error pages
components/    Reusable UI and feature components
hooks/         Client-side reusable hooks
lib/           Shared utilities and infrastructure
server/        Server-only composition point for future domain services
services/      Feature service contracts as the application grows
prisma/        Prisma schema and migrations
types/         Shared TypeScript types
public/        Static assets
```

## Requirements

- Node.js 20.9+ (Node 22 LTS recommended)
- pnpm 11+
- PostgreSQL 15+

## Setup

1. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Set `DATABASE_URL` in `.env` to a PostgreSQL database you control.

3. Generate strong values for `AUTH_SECRET` and `CRON_SECRET` (at least 32 random bytes each).

4. Install dependencies:

   ```powershell
   pnpm install
   ```

5. Apply the committed database migrations:

   ```powershell
   pnpm db:deploy
   ```

6. Add development demo data (never use this for production data):

   ```powershell
   pnpm db:seed
   ```

7. Start development:

   ```powershell
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable                | Required   | Purpose                                                           |
| ----------------------- | ---------- | ----------------------------------------------------------------- |
| `DATABASE_URL`          | Yes        | PostgreSQL connection string                                      |
| `AUTH_SECRET`           | Yes        | High-entropy secret for secure authentication                     |
| `CRON_SECRET`           | Production | Protects future scheduled job calls                               |
| `APP_ORIGIN`            | Production | Comma-separated permitted app origins                             |
| `SMS_PROVIDER`          | No         | `console` for local development; change later for a real provider |
| `SMS_SENDER_ID`         | No         | Sender label for future SMS delivery                              |
| `SMS_WEBHOOK_URL`       | No         | Adapter endpoint for a future SMS provider                        |
| `SMS_WEBHOOK_TOKEN`     | No         | Secret used by the webhook SMS adapter                            |
| `ALLOW_PRODUCTION_SEED` | No         | Must be `true` to deliberately allow a production seed run        |

Never commit `.env` or put secrets in `NEXT_PUBLIC_*` variables.

## Commands

| Command                            | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `pnpm dev`                         | Run the development server                            |
| `pnpm lint`                        | Run ESLint                                            |
| `pnpm format`                      | Check formatting with Prettier                        |
| `pnpm format:write`                | Apply Prettier formatting                             |
| `pnpm db:validate`                 | Validate the Prisma schema                            |
| `pnpm db:generate`                 | Generate Prisma Client                                |
| `pnpm db:migrate -- --name <name>` | Create/apply a local migration                        |
| `pnpm db:deploy`                   | Apply committed migrations in production              |
| `pnpm db:seed`                     | Insert idempotent development demo data               |
| `pnpm db:verify`                   | Read-only verification of the seeded Stage 2 data     |
| `pnpm build`                       | Generate Prisma Client and produce a production build |
| `pnpm start`                       | Run the production server after building              |

## Production build

1. Set every required production environment variable.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm db:deploy`.
4. Run `pnpm build`.
5. Run `pnpm start` behind HTTPS.

The public landing page is available at `/`. The authenticated application routes are intentionally protected by the application layout and will lead to sign-in until an account exists.

## Stage 2 database design

Every business-owned record has a `businessId`. Server-side finance helpers always scope a customer query to both `businessId` and `customerId`, and the Stage 2 migration also creates composite tenant/customer foreign keys so a transaction cannot be connected to another business's customer at database level.

The migrations enable row-level security on every application table and revoke access from Supabase's `anon` and `authenticated` roles. KIDAFTARI uses its own server-side sessions and Prisma connection, so these tables deliberately have no browser Data API policies. Tenant authorization remains enforced by the server; the database connection must use a trusted server role that can access the tables. The financial-history trigger also uses a fixed search path.

The canonical financial tables are `CreditTransaction` and `Payment`. Amounts are positive whole TZS values; an outstanding balance is calculated as active credits minus active payments. Financial records are never deleted: corrections set the original record to `REVERSED` or `CANCELLED` with the actor, timestamp, and reason retained. A PostgreSQL trigger rejects updates to the amount, customer, date, reference, or other immutable financial fields. `AuditLog` adds a readable description plus structured before/after metadata.

The migration is additive. It keeps the original Stage 1 ledger tables as read-only history and backfills them into the canonical tables, so previously recorded financial data is preserved during the cutover.

Reusable server-only helpers are in `server/finance.ts`:

- `getCustomerBalance(customerId)`
- `getBusinessOutstandingBalance(businessId)`
- `getCustomerTransactionHistory(customerId)`

The public helpers derive or verify the signed-in tenant. Background work can use the explicitly named `...ForBusiness` variants only after it has established a trusted business scope.

## Development seed

`pnpm db:seed` is idempotent and never deletes or overwrites financial records. It creates one demo business, an owner, a staff account, four customers, credits, payments, an overdue reminder, an SMS job, and an audit event.

Run `pnpm db:verify` after seeding to confirm the tenant relationships and expected TZS 110,000 outstanding balance.

The approved Supabase development deployment is complete. See [Stage 2 verification](docs/stage-2-verification.md) for the applied migrations, demo balances, database checks, and remaining local-preview limitation.

Demo sign-in credentials (development only):

- `owner@kidaftari.test` / `DemoPassword123!`
- `staff@kidaftari.test` / `DemoPassword123!`

# kidaftari
