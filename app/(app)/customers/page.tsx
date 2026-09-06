import Link from "next/link";
import { CustomerStatusBadge } from "@/components/customer-status-badge";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { formatTzs, phoneForDisplay } from "@/lib/formatters";
import { getCustomerList } from "@/lib/customer-data";
import { requireActor } from "@/lib/tenant";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const actor = await requireActor();
  const query = (await searchParams).q ?? "";
  const archived = (await searchParams).archived;
  const customers = await getCustomerList(actor.business.id, query);
  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who buys from you on credit."
        actions={
          <Link className="btn-primary" href="/customers/new">
            + Add customer
          </Link>
        }
      />
      {archived ? (
        <FlashMessage
          message="Customer archived. Their financial history is still preserved."
          tone="info"
        />
      ) : null}
      <div className="toolbar">
        <form className="search-form">
          <input
            className="search-input"
            name="q"
            defaultValue={query}
            placeholder="Search by name or phone"
          />
          <button className="btn-secondary" type="submit">
            Search
          </button>
        </form>
        <Link className="btn-secondary" href="/credits/new">
          Record credit
        </Link>
      </div>
      {customers.length ? (
        <div className="customer-cards">
          {customers.map((customer) => (
            <Link className="customer-card" href={`/customers/${customer.id}`} key={customer.id}>
              <div>
                <h2>{customer.fullName}</h2>
                <p>
                  {customer.phoneE164 ? phoneForDisplay(customer.phoneE164) : "No mobile number"}
                </p>
              </div>
              <div className="customer-card-right">
                <CustomerStatusBadge status={customer.status} />
                <strong className="customer-balance">{formatTzs(customer.balanceTzs)}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title={query ? "No customer found" : "No customers yet"}
          description={
            query
              ? "Try a different name or phone number."
              : "Add the first person who buys from you on credit."
          }
          actionHref={query ? "/customers" : "/customers/new"}
          actionLabel={query ? "Clear search" : "Add customer"}
        />
      )}
    </>
  );
}
