import Link from "next/link";
import { CreditForm } from "@/components/transactions/transaction-forms";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { addDays, todayInTanzania } from "@/lib/dates";
import { dateInputValue } from "@/lib/formatters";
import { getCustomerList } from "@/lib/customer-data";
import { requireActor } from "@/lib/tenant";

export default async function NewCreditPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const actor = await requireActor();
  const customers = await getCustomerList(actor.business.id);
  const desiredId = (await searchParams).customerId;
  const initialCustomerId = customers.some((customer) => customer.id === desiredId)
    ? desiredId!
    : (customers[0]?.id ?? "");
  return (
    <>
      <PageHeader
        title="Record credit"
        description="Record what the customer took. Their balance will increase."
        actions={
          <Link className="btn-secondary" href="/dashboard">
            Cancel
          </Link>
        }
      />
      {customers.length ? (
        <CreditForm
          customers={customers.map(({ id, fullName, balanceTzs }) => ({
            id,
            fullName,
            balanceTzs,
          }))}
          initialCustomerId={initialCustomerId}
          defaultDueDate={dateInputValue(
            addDays(todayInTanzania(), actor.business.defaultCreditDueDays),
          )}
        />
      ) : (
        <EmptyState
          title="Add a customer first"
          description="Credit always belongs to a customer, so start by adding them to your notebook."
          actionHref="/customers/new"
          actionLabel="Add customer"
        />
      )}
    </>
  );
}
