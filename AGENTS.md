# KIDAFTARI project instructions

## Stage completion and synchronization

The user has authorized committing and pushing completed stage work to GitHub,
and applying the corresponding database migrations to the development Supabase
project after every stage. Carry this forward without asking for the same approval
again.

- GitHub repository: `https://github.com/kevomziray/kidaftari`.
- Development Supabase project: `enzhzvrkagyxqewevnab` (Kidaftari). The user has
  designated this as development even though its primary branch is labeled
  production in the Supabase dashboard.
- At the end of each stage, run the relevant checks, review the exact files to be
  committed for credentials and unintended changes, commit the stage, and push it.
  Verify that the remote branch contains the resulting commit.
- For stages with database changes, apply the versioned migrations to the
  development project and verify the affected data and relationships. Keep Prisma
  migration history consistent with the migration files. Never edit a migration
  that has already been applied; create a subsequent migration for changes.
- Preserve existing financial and customer records. Add or extend development
  fixtures only when the stage needs them; do not reset, erase, or overwrite
  existing data. Do not seed a production target or send live SMS as part of
  routine verification.
- GitHub stores source code, migrations, seed scripts, and documentation. Keep
  live database contents, `.env` files, credentials, dependency folders, and build
  outputs out of Git. Only `.env.example` may contain placeholder settings.
- Summarize the completed stage, checks, database changes, and GitHub commit.
  State any remaining limitations accurately; do not describe an unverified
  preview or failed check as complete. If an external approval service blocks an
  operation, report the exact blocked operation and reason.
- Production deployment, destructive database changes, repository visibility
  changes, and force pushes require separate authorization.

This is an instruction for work performed in this project, not a scheduled job.
