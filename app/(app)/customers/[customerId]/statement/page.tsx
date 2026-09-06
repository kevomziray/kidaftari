import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatTzs } from "@/lib/formatters";
import { getCustomerDetail } from "@/lib/customer-data";
import { requireActor } from "@/lib/tenant";

export default async function CustomerStatementPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const actor = await requireActor();
  const { customerId } = await params;
  const customer = await getCustomerDetail(actor.business.id, customerId);
  if (!customer) notFound();
  return (
    <section className="card" style={{ maxWidth: "800px" }}>
      <div className="card-heading">
        <div>
          <p className="row-subtitle">{actor.business.businessName}</p>
          <h1 style={{ margin: "4px 0 0" }}>Customer statement</h1>
        </div>
        <Link className="btn-secondary" href={`/customers/${customer.id}`}>
          Back to customer
        </Link>
      </div>
      <div className="customer-row">
        <span className="row-title">
          {customer.fullName}
          <span className="row-subtitle">{customer.phoneE164 ?? ""}</span>
        </span>
        <span className="row-amount">
          Outstanding
          <br />
          <strong>{formatTzs(customer.balanceTzs)}</strong>
        </span>
      </div>
      <div className="timeline">
        {[...customer.ledgerEntries].reverse().map((entry) => (
          <div className="timeline-item" key={entry.id}>
            <span className="timeline-dot" />
            <div>
              <h3>{entry.type.replace("_", " ")}</h3>
              <p>
                {formatDate(entry.occurredAt)}
                {entry.dueDate ? ` · Due ${formatDate(entry.dueDate)}` : ""}
                {entry.description ? ` · ${entry.description}` : ""}
              </p>
            </div>
            <strong>
              {entry.type === "PAYMENT" ? "−" : "+"}
              {formatTzs(entry.amountTzs)}
            </strong>
          </div>
        ))}
      </div>
      <p className="row-subtitle" style={{ marginTop: "24px" }}>
        This statement is generated from KIDAFTARI&apos;s immutable transaction record.
      </p>
    </section>
  );
}
