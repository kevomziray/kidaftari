import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function RemindersPage() {
  await requirePermission("configure_reminders");
  return (
    <>
      <PageHeader title="Reminders" description="Helpful payment reminders, in one place." />
      <RoutePlaceholder
        title="Automatic reminders"
        description="This Stage 1 route is ready for reminder scheduling and SMS delivery status."
      />
    </>
  );
}
