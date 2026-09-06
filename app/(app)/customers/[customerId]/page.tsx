import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ManualReminderForm,
  ReverseTransactionForm,
} from "@/components/customers/customer-actions";
import { CustomerStatusBadge } from "@/components/customer-status-badge";
import { FlashMessage } from "@/components/flash-message";
import { formatDate, formatDateTime, formatTzs, phoneForDisplay } from "@/lib/formatters";
import { getCustomerDetail } from "@/lib/customer-data";
import { can } from "@/lib/permissions";
import { requireActor } from "@/lib/tenant";

function entryLabel(type: string) {
  return (
    {
      CREDIT: "Credit recorded",
      PAYMENT: "Payment recorded",
      CREDIT_REVERSAL: "Credit reversed",
      PAYMENT_REVERSAL: "Payment reversed",
    }[type] ?? type
  );
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ created?: string; credit?: string; payment?: string; reversed?: string }>;
}) {
  const actor = await requireActor();
  const { customerId } = await params;
  const flags = await searchParams;
  const customer = await getCustomerDetail(actor.business.id, customerId);
  if (!customer) notFound();
  const canReverse = can(actor.membership.role, "reverse_transactions");
  const flash = flags.created
    ? "Customer added successfully."
    : flags.credit === "recorded"
      ? "Credit recorded and reminders scheduled."
      : flags.credit
        ? "This credit was already recorded."
        : flags.payment === "recorded"
          ? "Payment recorded. A confirmation SMS has been queued if the customer has a mobile number."
          : flags.payment
            ? "This payment was already recorded."
            : flags.reversed
              ? "Transaction reversed and audit trail saved."
              : undefined;

  return (
    <>
      <Link className="back-link" href="/customers">
        ← Customers
      </Link>
      <section className="summary-header">
        <div>
          <CustomerStatusBadge status={customer.status} />
          <h1>{customer.fullName}</h1>
          <p>
            {customer.phoneE164 ? phoneForDisplay(customer.phoneE164) : "No mobile number"}
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
        </div>
        <div className="summary-balance">
          <span>Outstanding balance</span>
          <strong>{formatTzs(customer.balanceTzs)}</strong>
        </div>
      </section>
      <FlashMessage message={flash} />
      <section className="customer-actions">
        <Link className="btn-primary" href={`/credits/new?customerId=${customer.id}`}>
          + Record credit
        </Link>
        <Link className="btn-secondary" href={`/payments/new?customerId=${customer.id}`}>
          + Record payment
        </Link>
        {customer.balanceTzs > 0 && can(actor.membership.role, "send_reminders") ? (
          <ManualReminderForm customerId={customer.id} />
        ) : null}
        <Link className="btn-secondary" href={`/customers/${customer.id}/statement`}>
          View statement
        </Link>
      </section>
      <section className="content-grid">
        <section className="card">
          <div className="card-heading">
            <h2>Activity</h2>
            <span className="row-subtitle">Never edited, always traceable</span>
          </div>
          {customer.ledgerEntries.length ? (
            <div className="timeline">
              {customer.ledgerEntries.map((entry) => {
                const isPayment = entry.type === "PAYMENT";
                const isReversal = entry.type.endsWith("REVERSAL");
                return (
                  <article
                    className={`timeline-item ${entry.reversal ? "timeline-reversed" : ""}`}
                    key={entry.id}
                  >
                    <span
                      className={`timeline-dot ${isReversal ? "reversal" : isPayment ? "payment" : ""}`}
                    />
                    <div>
                      <h3>
                        {entryLabel(entry.type)} {entry.reversal ? "(reversed)" : ""}
                      </h3>
                      <p>
                        {formatDateTime(entry.occurredAt)}
                        {entry.dueDate ? ` · Due ${formatDate(entry.dueDate)}` : ""}
                        {entry.paymentMethod
                          ? ` · ${entry.paymentMethod.replace("_", " ").toLowerCase()}`
                          : ""}
                      </p>
                      {entry.description ? <p>{entry.description}</p> : null}
                      {entry.reversalReason ? <p>Reason: {entry.reversalReason}</p> : null}
                      {entry.createdBy?.name ? <p>Recorded by {entry.createdBy.name}</p> : null}
                      {canReverse && !entry.reversal && !isReversal ? (
                        <ReverseTransactionForm transactionId={entry.id} />
                      ) : null}
                    </div>
                    <strong className={isPayment ? "amount-payment" : "amount-credit"}>
                      {isPayment ? "−" : "+"}
                      {formatTzs(entry.amountTzs)}
                    </strong>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="row-subtitle">No credit or payment has been recorded yet.</p>
          )}
        </section>
        <aside className="card">
          <div className="card-heading">
            <h2>Customer details</h2>
          </div>
          <div className="list-stack">
            <p className="row-subtitle">
              <strong>Payment period:</strong>{" "}
              {customer.defaultDueDays ?? actor.business.defaultCreditDueDays} days
            </p>
            <p className="row-subtitle">
              <strong>Address:</strong> {customer.address ?? "Not added"}
            </p>
            <p className="row-subtitle">
              <strong>Notes:</strong> {customer.notes ?? "No notes"}
            </p>
          </div>
          <div className="card-heading" style={{ marginTop: "22px" }}>
            <h2>Recent SMS</h2>
          </div>
          {customer.smsMessages.length ? (
            <div className="list-stack">
              {customer.smsMessages.slice(0, 5).map((message) => (
                <div className="activity-row" key={message.id}>
                  <span className="row-title">
                    {message.kind.replace("_", " ").toLowerCase()}
                    <span className="row-subtitle">{formatDateTime(message.createdAt)}</span>
                  </span>
                  <span className="status-badge status-active-credit">
                    {message.status.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="row-subtitle">No SMS sent yet.</p>
          )}
        </aside>
      </section>
    </>
  );
}
