import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" description="Keep received payments clear and easy to find." />
      <RoutePlaceholder
        title="Payment records"
        description="This Stage 1 route is ready for the payment-recording workflow."
        primaryAction={{ href: "/payments/new", label: "Record payment" }}
      />
    </>
  );
}
