# Stage 3 authentication and onboarding testing

Stage 3 uses application-managed accounts and revocable database sessions. Passwords are stored as bcrypt hashes with cost 12. The browser receives only a random session token in an HttpOnly, SameSite cookie; the database stores its SHA-256 hash.

## Before testing

1. Copy `.env.example` to `.env` and set a working `DATABASE_URL` plus a random `AUTH_SECRET` of at least 32 characters.
2. Run `pnpm install --frozen-lockfile` and `pnpm db:deploy`.
3. Start the app with `pnpm dev`, then open `http://localhost:3000` (use the origin listed in `APP_ORIGIN`).
4. For automated security checks, run `pnpm test`.

## Registration and onboarding

1. Open `/register`.
2. Enter a full name, a Tanzanian phone number or email, a password of 10–72 bytes, a business name, and a business phone.
3. Submit once. Confirm that the app opens onboarding and creates one business with one OWNER user.
4. Complete the five steps: business name, business phone, location, language, and reminder preference.
5. Refresh or sign out midway and sign back in. Confirm that setup resumes at the saved step.
6. Try reusing the same user phone or email. Confirm that registration is rejected without revealing which field already belongs to an account.

## Login, session, and logout

1. Open `/login` and sign in with either the normalized phone number or email used at registration.
2. Confirm that a completed account opens `/dashboard`; an unfinished owner returns to `/onboarding`.
3. Enter an incorrect password and confirm the generic “Phone/email or password is incorrect” message.
4. Submit 11 incorrect attempts for one identifier within 15 minutes. Confirm later attempts are throttled.
5. While signed in, alter or replace the `kidaftari_session` cookie in browser developer tools. Reload and confirm the app redirects to `/login`.
6. Sign out. Use the browser Back button or revisit `/dashboard`; confirm the revoked session cannot reopen the app.

## Owner permissions

Sign in as an OWNER and confirm access to customers, credit, payments, transaction history, reports, reminders, Settings, and Staff. Add a staff account in `/staff`, change its active state, and explicitly toggle reversal permission. Confirm that any access change signs that staff account out.

## Staff permissions

Sign in as STAFF and confirm that the account can view and add customers, record credit, record payments, and view customer transaction history. Confirm that Reports, Reminders, Settings, and Staff are absent from navigation and direct visits redirect to `/access-denied`. Customer archive, manual SMS reminders, business settings, staff management, and transaction reversal must fail. Enable reversal permission as the owner, sign in again as staff, and confirm reversal becomes available while the other owner-only permissions remain blocked.

## Unauthorized and cross-business routes

1. Sign out and visit `/dashboard`, `/customers`, `/reports`, `/settings`, and `/staff`; each must redirect to `/login`.
2. As STAFF, visit `/reports`, `/reminders`, `/settings`, and `/staff` directly; each must redirect to `/access-denied`.
3. With two test businesses, copy a customer UUID from business A and request `/customers/<uuid>` while signed into business B. Confirm a not-found response.
4. Repeat with credit, payment, reversal, customer archive, and staff IDs submitted from the other business. Confirm no record changes and no cross-business data appears.

Do not use live customer phone numbers or enable a live SMS provider for these checks.
