import Link from "next/link";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/page-header";

export default async function NewCustomerPage() {
  return (
    <>
      <PageHeader
        title="Add customer"
        description="Add only the details you need. You can fill in the rest later."
        actions={
          <Link className="btn-secondary" href="/customers">
            Cancel
          </Link>
        }
      />
      <CustomerForm />
    </>
  );
}
