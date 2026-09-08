import { PageHeader } from "@/components/page-header";
import { BusinessSettingsForm } from "@/components/auth/business-settings-form";
import { requirePermission } from "@/lib/tenant";

export default async function SettingsPage() {
  const { business: b } = await requirePermission("manage_business");
  return (
    <>
      <PageHeader title="Settings" description="Your business details and preferences." />
      <BusinessSettingsForm
        business={{
          businessName: b.businessName,
          businessPhone: b.businessPhone,
          businessEmail: b.businessEmail,
          address: b.address,
          language: b.language,
          defaultCreditDueDays: b.defaultCreditDueDays,
          remindersEnabled: b.remindersEnabled,
          reminderDaysBeforeDue: b.reminderDaysBeforeDue,
          overdueReminderIntervalDays: b.overdueReminderIntervalDays,
          reminderLocalTime: b.reminderLocalTime,
          sendPaymentConfirmations: b.sendPaymentConfirmations,
        }}
      />
    </>
  );
}
