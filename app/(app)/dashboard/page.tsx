import Link from "next/link";
import { CustomerStatusBadge } from "@/components/customer-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatTzs } from "@/lib/formatters";
import { getDashboardData } from "@/lib/customer-data";
import { requireActor } from "@/lib/tenant";

export default async function DashboardPage() {
  const actor = await requireActor();
  const data = await getDashboardData(actor.business.id);
  const activeCreditCount = data.customers.filter((customer) => customer.balanceTzs > 0).length;
  const welcome = "";

  return (
    <>
      <PageHeader
        title={`Good day, ${actor.user.name.split(" ")[0]}`}
        description="Here is your credit notebook today."
      />
      {welcome ? <p>{welcome}</p> : null}
      <section className="balance-hero" aria-label="Outstanding customer balance">
        <span>Customers owe you</span>
        <strong>{formatTzs(data.outstandingTzs)}</strong>
        <small>
          {activeCreditCount} customer{activeCreditCount === 1 ? "" : "s"} with an active balance
        </small>
      </section>
      <section className="quick-actions" aria-label="Quick actions">
        <Link href="/customers/new">
          + Add customer<span>Start with a customer</span>
        </Link>
        <Link href="/credits/new">
          + Record credit<span>Customer bought on credit</span>
        </Link>
        <Link href="/payments/new">
          + Record payment<span>Customer has paid you</span>
        </Link>
      </section>
      {data.customers.length === 0 ? (
        <EmptyState
          title="Your notebook is ready"
          description="Add your first customer, then record any credit they take."
          actionHref="/customers/new"
          actionLabel="Add your first customer"
        />
      ) : (
        <section className="content-grid">
          <section className="card">
            <div className="card-heading">
              <h2>Needs your attention</h2>
              <Link href="/customers">View all customers</Link>
            </div>
            {data.dueCustomers.length ? (
              <div className="list-stack">
                {data.dueCustomers.slice(0, 6).map((customer) => (
                  <Link
                    href={`/customers/${customer.id}`}
                    className="customer-row"
                    key={customer.id}
                  >
                    <span className="row-title">
                      {customer.fullName}
                      <span className="row-subtitle">
                        {customer.phoneE164 ?? "No mobile number"}
                      </span>
                    </span>
                    <span className="row-amount">
                      {formatTzs(customer.balanceTzs)}
                      <CustomerStatusBadge status={customer.status} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="row-subtitle">No balances are due soon. Nice work.</p>
            )}
          </section>
          <section className="card">
            <div className="card-heading">
              <h2>Recent activity</h2>
            </div>
            {data.recentActivity.length ? (
              <div className="list-stack">
                {data.recentActivity.map((entry) => {
                  const isPayment = entry.type === "PAYMENT";
                  return (
                    <Link
                      href={`/customers/${entry.customerId}`}
                      className="activity-row"
                      key={entry.id}
                    >
                      <span className="row-title">
                        {entry.customer.fullName}
                        <span className="row-subtitle">
                          {entry.type.replace("_", " ").toLowerCase()} ·{" "}
                          {formatDate(entry.occurredAt)}
                        </span>
                      </span>
                      <strong className={isPayment ? "amount-payment" : "amount-credit"}>
                        {isPayment ? "−" : "+"}
                        {formatTzs(entry.amountTzs)}
                      </strong>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="row-subtitle">Your recorded activity will appear here.</p>
            )}
          </section>
        </section>
      )}
    </>
  );
}
