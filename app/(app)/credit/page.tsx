import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function CreditPage() {
  return (
    <>
      <PageHeader title="Credit" description="Record credit sales in one simple step." />
      <RoutePlaceholder
        title="Credit records"
        description="This Stage 1 route is ready for the credit-recording workflow."
        primaryAction={{ href: "/credits/new", label: "Record credit" }}
      />
    </>
  );
}
