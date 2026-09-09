# Stage 4 customer management testing

Stage 4 customer pages are available only after sign-in and completed onboarding. Use development accounts and phone numbers; keep the SMS provider set to console or mock.

## Before testing

1. Set a working development DATABASE_URL, AUTH_SECRET, and APP_ORIGIN in the ignored .env file.
2. Run **pnpm install --frozen-lockfile**, **pnpm db:deploy**, and **pnpm dev**.
3. Open http://localhost:3000, register or sign in, and finish onboarding.
4. Run **pnpm test** for the automated balance, customer-number, authorization, and tenant-isolation checks.

## Create a customer

1. Open **/customers** and choose **Add customer**.
2. Enter a full name and Tanzania mobile number such as **0712 345 678**. Fill the optional alternate phone, address, credit limit, reminder frequency, language, and notes.
3. Save and confirm that the profile opens with a number in the form **KDF-000001**.
4. Add another customer and confirm that the number increments within the business.
5. Try a missing number, a landline, too few digits, and a non-Tanzania country code. Confirm that the form shows a clear validation error and creates no customer.

## Search and filter

1. Search by full or partial name.
2. Search by **KDF-000001**.
3. Search the same phone using **0712**, **255712**, and **+255712**; each should find the same customer.
4. Use **All**, **Has balance**, **Paid**, **Due soon**, and **Overdue**. Confirm that the selected filter stays active when a search is submitted.
5. Search for a value that does not exist and confirm the empty state offers **Show all customers**.

## Edit and view

1. Sign in as OWNER, open a customer, and choose **Edit customer**.
2. Change the name, alternate phone, address, credit limit, reminder setting, frequency, language, and notes.
3. Save and confirm the profile shows the changes while the customer number remains unchanged.
4. Confirm the profile clearly shows current balance, credit limit, payment status, total credit, total paid, last payment, oldest outstanding credit, and next due date.
5. Sign in as STAFF. Confirm the profile and transaction history are visible, but **Edit customer**, **Deactivate customer**, and **Send reminder** are unavailable.

## Balance and transaction history

1. Record two credits with different dates and due dates.
2. Record a partial payment. Confirm current balance equals active credits minus active payments.
3. Confirm the transaction table shows date, description, credit, payment, and the balance after each transaction.
4. Confirm the oldest outstanding credit moves forward after payments cover earlier credit first.
5. As an authorized owner, reverse one transaction after accepting the confirmation. Confirm the row remains visible as reversed and no longer affects totals or the running balance.
6. Open **View statement** and compare its transactions with the customer profile.

## Deactivate

1. As OWNER, open a customer and choose **Deactivate customer**.
2. Read the confirmation dialog and continue.
3. Confirm the customer disappears from the active list and cannot receive new credit or payments.
4. Revisit the saved profile URL and confirm it is marked inactive while its customer, credit, payment, and audit records remain available.
5. Confirm there is no customer-delete action.

## Tenant isolation and unauthorized routes

1. Create business A and business B with separate owners.
2. Copy a customer UUID from business A and request **/customers/<uuid>** and **/customers/<uuid>/edit** while signed into business B. Both must return not found and show no customer data.
3. Submit business A's customer UUID to an edit, deactivation, credit, payment, reminder, or reversal action while signed into business B. Confirm no row changes.
4. Sign out and visit **/customers**, **/customers/new**, and a saved customer URL. Each must redirect to **/login**.
5. As STAFF, visit a saved **/customers/<uuid>/edit** URL. Confirm it redirects to **/access-denied**.

No live SMS should be sent during these checks.
