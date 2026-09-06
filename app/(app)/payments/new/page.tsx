import Link from "next/link";
import { PaymentForm } from "@/components/transactions/transaction-forms";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { todayInTanzania } from "@/lib/dates";
import { dateInputValue } from "@/lib/formatters";
import { getCustomerList } from "@/lib/customer-data";
import { requireActor } from "@/lib/tenant";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const actor = await requireActor();
  const customers = (await getCustomerList(actor.business.id)).filter(
    (customer) => customer.balanceTzs > 0,
  );
  const desiredId = (await searchParams).customerId;
  const initialCustomerId = customers.some((customer) => customer.id === desiredId)
    ? desiredId!
    : (customers[0]?.id ?? "");
  return (
    <>
      <PageHeader
        title="Record payment"
        description="Record money you received. The customer balance will decrease."
        actions={
          <Link className="btn-secondary" href="/dashboard">
            Cancel
          </Link>
        }
      />
      {customers.length ? (
        <PaymentForm
          customers={customers.map(({ id, fullName, balanceTzs }) => ({
            id,
            fullName,
            balanceTzs,
          }))}
          initialCustomerId={initialCustomerId}
          today={dateInputValue(todayInTanzania())}
        />
      ) : (
        <EmptyState
          title="No payment to record"
          description="Every active customer balance is already settled."
          actionHref="/customers"
          actionLabel="View customers"
        />
      )}
    </>
  );
}
