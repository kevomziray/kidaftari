"use client";

import { useActionState } from "react";
import type { Business } from "@prisma/client";
import { updateBusinessSettingsAction } from "@/app/actions/business";
import { ActionMessage } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

type Settings = Pick<
  Business,
  | "businessName"
  | "businessPhone"
  | "businessEmail"
  | "address"
  | "language"
  | "defaultCreditDueDays"
  | "remindersEnabled"
  | "reminderDaysBeforeDue"
  | "overdueReminderIntervalDays"
  | "reminderLocalTime"
  | "sendPaymentConfirmations"
>;

export function BusinessSettingsForm({ business: b }: { business: Settings }) {
  const [state, action] = useActionState(updateBusinessSettingsAction, {} as ActionState);
  return (
    <form action={action} className="auth-form">
      <ActionMessage state={state} />
      <div className="content-grid">
        <section className="card space-y-4">
          <h2>Business details</h2>
          <label className="field">
            <span>Business name</span>
            <input name="name" defaultValue={b.businessName} maxLength={160} required />
          </label>
          <label className="field">
            <span>Business phone</span>
            <input name="phone" type="tel" defaultValue={b.businessPhone ?? ""} maxLength={32} />
          </label>
          <label className="field">
            <span>Business email (optional)</span>
            <input name="email" type="email" defaultValue={b.businessEmail ?? ""} maxLength={320} />
          </label>
          <label className="field">
            <span>Location</span>
            <input name="address" defaultValue={b.address ?? ""} maxLength={1000} />
          </label>
          <label className="field">
            <span>Customer message language</span>
            <select name="locale" defaultValue={b.language}>
              <option value="EN">English</option>
              <option value="SW">Kiswahili</option>
            </select>
          </label>
        </section>
        <section className="card space-y-4">
          <h2>Reminders and SMS preferences</h2>
          <label className="field">
            <span>Default credit period (days)</span>
            <input
              name="defaultCreditDueDays"
              type="number"
              min={0}
              max={365}
              defaultValue={b.defaultCreditDueDays}
              required
            />
          </label>
          <label className="field">
            <span>Schedule reminders</span>
            <select name="remindersEnabled" defaultValue={String(b.remindersEnabled)}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <label className="field">
            <span>Days before payment is due</span>
            <input
              name="reminderDaysBeforeDue"
              type="number"
              min={0}
              max={30}
              defaultValue={b.reminderDaysBeforeDue}
              required
            />
          </label>
          <label className="field">
            <span>Days between overdue reminders</span>
            <input
              name="overdueReminderIntervalDays"
              type="number"
              min={1}
              max={90}
              defaultValue={b.overdueReminderIntervalDays}
              required
            />
          </label>
          <label className="field">
            <span>Reminder time (Tanzania)</span>
            <input
              name="reminderLocalTime"
              type="time"
              defaultValue={b.reminderLocalTime}
              required
            />
          </label>
          <label className="field">
            <span>Payment confirmation SMS</span>
            <select
              name="sendPaymentConfirmations"
              defaultValue={String(b.sendPaymentConfirmations)}
            >
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <p className="row-subtitle">
            SMS delivery requires a configured provider. These settings save your preferences.
          </p>
        </section>
      </div>
      <FormSubmitButton pendingLabel="Saving…">Save settings</FormSubmitButton>
    </form>
  );
}
