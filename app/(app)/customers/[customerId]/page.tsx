import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DeactivateCustomerDialog,
  ManualReminderForm,
  ReverseTransactionForm,
} from "@/components/customers/customer-actions";
import { CustomerStatusBadge } from "@/components/customer-status-badge";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { formatDate, formatDateTime, formatTzs, phoneForDisplay } from "@/lib/formatters";
import { getCustomerDetail } from "@/lib/customer-data";
import { can } from "@/lib/permissions";
import { requireActor } from "@/lib/tenant";

function transactionDescription(entry: {
  type: "CREDIT" | "PAYMENT";
  description: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
}) {
  if (entry.description) return entry.description;
  if (entry.type === "PAYMENT") {
    const method = entry.paymentMethod?.replaceAll("_", " ").toLowerCase() ?? "payment";
    return entry.paymentReference ? method + " · " + entry.paymentReference : method;
  }
  return "Credit recorded";
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    credit?: string;
    payment?: string;
    reversed?: string;
  }>;
}) {
  const actor = await requireActor();
  const { customerId } = await params;
  const flags = await searchParams;
  const customer = await getCustomerDetail(actor.business.id, customerId);
  if (!customer) notFound();

  const canManage = can(actor.membership.role, "manage_customers");
  const canReverse = can(
    actor.membership.role,
    "reverse_transactions",
    actor.user.canReverseTransactions,
  );
  const flash = flags.created
    ? "Customer added successfully."
    : flags.updated
      ? "Customer details updated."
      : flags.credit === "recorded"
        ? "Credit recorded and reminders scheduled."
        : flags.credit
          ? "This credit was already recorded."
          : flags.payment === "recorded"
            ? "Payment recorded. A confirmation SMS was queued when a mobile number was available."
            : flags.payment
              ? "This payment was already recorded."
              : flags.reversed
                ? "Transaction reversed and audit trail saved."
                : undefined;

  return (
    <>
      <div className="profile-topline">
        <Link className="back-link" href="/customers">
          ← Customers
        </Link>
        {canManage && customer.active ? (
          <Link className="btn-secondary" href={"/customers/" + customer.id + "/edit"}>
            Edit customer
          </Link>
        ) : null}
      </div>
      {!customer.active ? (
        <FlashMessage
          message="This customer is inactive. Their financial history is read-only and preserved."
          tone="info"
        />
      ) : null}
      <section className="summary-header customer-profile-header">
        <div>
          <div className="profile-badges">
            <CustomerStatusBadge status={customer.status} />
            <span className="customer-number">{customer.customerNumber}</span>
          </div>
          <h1>{customer.fullName}</h1>
          <p>
            {customer.phoneE164 ? phoneForDisplay(customer.phoneE164) : "No phone number added"}
          </p>
        </div>
        <div className="summary-balance">
          <span>Current balance</span>
          <strong>{formatTzs(customer.balanceTzs)}</strong>
          <small>
            Credit limit:{" "}
            {customer.creditLimit === null ? "No limit" : formatTzs(customer.creditLimit)}
          </small>
        </div>
      </section>
      <FlashMessage message={flash} />
      {customer.active ? (
        <section className="customer-actions" aria-label="Customer actions">
          <Link className="btn-primary" href={"/credits/new?customerId=" + customer.id}>
            + Record credit
          </Link>
          <Link className="btn-secondary" href={"/payments/new?customerId=" + customer.id}>
            + Record payment
          </Link>
          {customer.balanceTzs > 0 && can(actor.membership.role, "send_reminders") ? (
            <ManualReminderForm customerId={customer.id} />
          ) : null}
          <Link className="btn-secondary" href={"/customers/" + customer.id + "/statement"}>
            View statement
          </Link>
        </section>
      ) : null}

      <section className="customer-summary-grid" aria-label="Customer financial summary">
        <article>
          <span>Total credit</span>
          <strong>{formatTzs(customer.totalCreditTzs)}</strong>
        </article>
        <article>
          <span>Total paid</span>
          <strong>{formatTzs(customer.totalPaidTzs)}</strong>
        </article>
        <article>
          <span>Current balance</span>
          <strong>{formatTzs(customer.balanceTzs)}</strong>
        </article>
        <article>
          <span>Last payment</span>
          <strong>{customer.lastPayment ? formatDate(customer.lastPayment) : "None yet"}</strong>
        </article>
        <article>
          <span>Oldest outstanding credit</span>
          <strong>
            {customer.oldestOutstanding ? formatTzs(customer.oldestOutstanding.amountTzs) : "None"}
          </strong>
          {customer.oldestOutstanding ? (
            <small>From {formatDate(customer.oldestOutstanding.date)}</small>
          ) : null}
        </article>
        <article>
          <span>Next due date</span>
          <strong>{customer.nextDueDate ? formatDate(customer.nextDueDate) : "None"}</strong>
        </article>
      </section>

      <section className="content-grid customer-profile-grid">
        <section className="card transaction-card">
          <div className="card-heading">
            <div>
              <h2>Transaction history</h2>
              <span className="row-subtitle">
                Every credit and payment, with a running balance.
              </span>
            </div>
          </div>
          {customer.ledgerEntries.length ? (
            <div className="table-wrap transaction-table-wrap">
              <table className="data-table transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Credit</th>
                    <th>Payment</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.ledgerEntries.map((entry) => {
                    const reversed = Boolean(entry.reversal);
                    return (
                      <tr className={reversed ? "transaction-reversed" : ""} key={entry.id}>
                        <td>{formatDate(entry.occurredAt)}</td>
                        <td>
                          <span className="table-transaction">
                            <strong>
                              {transactionDescription(entry)}
                              {reversed ? " · Reversed" : ""}
                            </strong>
                            <small>{formatDateTime(entry.createdAt)}</small>
                            {entry.reversalReason ? (
                              <small>Reason: {entry.reversalReason}</small>
                            ) : null}
                          </span>
                          {canReverse && !reversed ? (
                            <ReverseTransactionForm transactionId={entry.id} />
                          ) : null}
                        </td>
                        <td className="money-cell amount-credit">
                          {entry.type === "CREDIT" ? formatTzs(entry.amountTzs) : "—"}
                        </td>
                        <td className="money-cell amount-payment">
                          {entry.type === "PAYMENT" ? formatTzs(entry.amountTzs) : "—"}
                        </td>
                        <td className="money-cell">{formatTzs(entry.balanceTzs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No transactions yet"
              description="Record credit when this customer buys now and will pay later."
              actionHref={customer.active ? "/credits/new?customerId=" + customer.id : undefined}
              actionLabel={customer.active ? "Record first credit" : undefined}
            />
          )}
        </section>
        <aside className="card customer-detail-card">
          <div className="card-heading">
            <h2>Customer details</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Phone</dt>
              <dd>{customer.phoneE164 ? phoneForDisplay(customer.phoneE164) : "Not added"}</dd>
            </div>
            <div>
              <dt>Alternative phone</dt>
              <dd>
                {customer.alternativePhone
                  ? phoneForDisplay(customer.alternativePhone)
                  : "Not added"}
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{customer.address ?? "Not added"}</dd>
            </div>
            <div>
              <dt>Preferred language</dt>
              <dd>{customer.preferredLanguage === "SW" ? "Kiswahili" : "English"}</dd>
            </div>
            <div>
              <dt>Reminders</dt>
              <dd>
                {customer.reminderEnabled
                  ? "Enabled · every " +
                    customer.reminderFrequency +
                    " day" +
                    (customer.reminderFrequency === 1 ? "" : "s")
                  : "Disabled"}
              </dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{customer.notes ?? "No notes"}</dd>
            </div>
          </dl>
          {canManage && customer.active ? (
            <div className="danger-zone">
              <h3>Deactivate customer</h3>
              <p>Use this when the customer should no longer appear in the active list.</p>
              <DeactivateCustomerDialog
                customerId={customer.id}
                customerName={customer.fullName}
                hasTransactions={customer.ledgerEntries.length > 0}
              />
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}
