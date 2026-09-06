import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Keep your business details and preferences up to date."
      />
      <RoutePlaceholder
        title="Business settings"
        description="This Stage 1 route is ready for business profile, language, staff, and reminder settings."
      />
    </>
  );
}
