import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Understand what customers owe at a glance." />
      <RoutePlaceholder
        title="Simple business reports"
        description="This Stage 1 route is ready for clear credit, payment, and outstanding-balance reports."
      />
    </>
  );
}
