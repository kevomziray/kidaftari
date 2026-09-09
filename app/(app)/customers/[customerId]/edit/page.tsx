import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/page-header";
import { getCustomerDetail } from "@/lib/customer-data";
import { requirePermission } from "@/lib/tenant";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const actor = await requirePermission("manage_customers");
  const { customerId } = await params;
  const customer = await getCustomerDetail(actor.business.id, customerId);
  if (!customer || !customer.active) notFound();

  return (
    <>
      <PageHeader
        title="Edit customer"
        description={"Update " + customer.fullName + "'s contact and reminder details."}
        actions={
          <Link className="btn-secondary" href={"/customers/" + customer.id}>
            Cancel
          </Link>
        }
      />
      <CustomerForm customer={customer} />
    </>
  );
}
