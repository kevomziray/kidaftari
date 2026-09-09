import Link from "next/link";
import { CustomerStatusBadge } from "@/components/customer-status-badge";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatTzs, phoneForDisplay } from "@/lib/formatters";
import { CUSTOMER_FILTERS, getCustomerList, type CustomerFilter } from "@/lib/customer-data";
import { can } from "@/lib/permissions";
import { requireActor } from "@/lib/tenant";

const filterLabels: Record<CustomerFilter, string> = {
  all: "All",
  balance: "Has balance",
  paid: "Paid",
  "due-soon": "Due soon",
  overdue: "Overdue",
};

function filterHref(filter: CustomerFilter, query: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const suffix = params.toString();
  return suffix ? `/customers?${suffix}` : "/customers";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; deactivated?: string }>;
}) {
  const actor = await requireActor();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const filter = CUSTOMER_FILTERS.includes(params.filter as CustomerFilter)
    ? (params.filter as CustomerFilter)
    : "all";
  const customers = await getCustomerList(actor.business.id, query, filter);
  const canManage = can(actor.membership.role, "manage_customers");

  return (
    <>
      <PageHeader
        title="Customers"
        description="Find a customer, check what they owe, or record a payment."
        actions={
          <Link className="btn-primary" href="/customers/new">
            + Add customer
          </Link>
        }
      />
      {params.deactivated ? (
        <FlashMessage
          message="Customer deactivated. Their credit and payment history is safely preserved."
          tone="info"
        />
      ) : null}
      <section className="customer-list-controls" aria-label="Customer search and filters">
        <form className="search-form">
          <input
            className="search-input"
            name="q"
            defaultValue={query}
            placeholder="Search name, phone or customer number"
            aria-label="Search customers"
          />
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <button className="btn-secondary" type="submit">
            Search
          </button>
          {query ? (
            <Link className="text-button" href={filterHref(filter, "")}>
              Clear
            </Link>
          ) : null}
        </form>
        <nav className="filter-pills" aria-label="Filter customers">
          {CUSTOMER_FILTERS.map((value) => (
            <Link
              key={value}
              className={filter === value ? "filter-pill active" : "filter-pill"}
              href={filterHref(value, query)}
            >
              {filterLabels[value]}
            </Link>
          ))}
        </nav>
      </section>
      {customers.length ? (
        <div className="table-wrap customer-table-wrap">
          <table className="data-table customer-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Last transaction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link className="table-primary-link" href={`/customers/${customer.id}`}>
                      {customer.fullName}
                    </Link>
                    <span className="table-secondary">{customer.customerNumber}</span>
                  </td>
                  <td>
                    {customer.phoneE164 ? phoneForDisplay(customer.phoneE164) : "No phone number"}
                  </td>
                  <td className="money-cell">{formatTzs(customer.balanceTzs)}</td>
                  <td>
                    <CustomerStatusBadge status={customer.status} />
                  </td>
                  <td>
                    {customer.lastTransaction ? (
                      <span className="table-transaction">
                        <strong>
                          {customer.lastTransaction.type === "CREDIT" ? "Credit" : "Payment"} ·{" "}
                          {formatTzs(customer.lastTransaction.amountTzs)}
                        </strong>
                        <small>{formatDate(customer.lastTransaction.occurredAt)}</small>
                      </span>
                    ) : (
                      <span className="table-secondary">None yet</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link href={`/customers/${customer.id}`}>View</Link>
                      {canManage ? <Link href={`/customers/${customer.id}/edit`}>Edit</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={query || filter !== "all" ? "No matching customers" : "No customers yet"}
          description={
            query || filter !== "all"
              ? "Try another search or clear the filter."
              : "Add your first customer to start recording credit and payments."
          }
          actionHref={query || filter !== "all" ? "/customers" : "/customers/new"}
          actionLabel={query || filter !== "all" ? "Show all customers" : "Add customer"}
        />
      )}
    </>
  );
}
