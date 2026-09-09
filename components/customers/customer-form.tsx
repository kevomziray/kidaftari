"use client";

import { useActionState } from "react";
import { createCustomerAction, updateCustomerAction } from "@/app/actions/customers";
import { ActionMessage, FieldError } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

type CustomerFormValues = {
  id: string;
  fullName: string;
  phone: string | null;
  alternativePhone: string | null;
  address: string | null;
  creditLimit: number | null;
  reminderEnabled: boolean;
  reminderFrequency: number;
  preferredLanguage: "EN" | "SW";
  notes: string | null;
};

export function CustomerForm({ customer }: { customer?: CustomerFormValues }) {
  const action = customer ? updateCustomerAction : createCustomerAction;
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="form-card customer-form-card">
      {customer ? <input type="hidden" name="customerId" value={customer.id} /> : null}
      <ActionMessage state={state} />
      <label className="field">
        <span>Full name *</span>
        <input
          name="fullName"
          autoComplete="name"
          placeholder="e.g. Neema Juma"
          defaultValue={customer?.fullName}
          required
          autoFocus
        />
        <FieldError state={state} name="fullName" />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Phone number *</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            defaultValue={customer?.phone ?? ""}
            required
          />
          <small className="field-hint">Tanzania mobile number, starting with 06 or 07.</small>
          <FieldError state={state} name="phone" />
        </label>
        <label className="field">
          <span>Alternative phone</span>
          <input
            name="alternativePhone"
            type="tel"
            inputMode="tel"
            placeholder="Optional"
            defaultValue={customer?.alternativePhone ?? ""}
          />
          <FieldError state={state} name="alternativePhone" />
        </label>
      </div>
      <label className="field">
        <span>Address</span>
        <input
          name="address"
          placeholder="Street, ward or town"
          defaultValue={customer?.address ?? ""}
        />
        <FieldError state={state} name="address" />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Credit limit (TZS)</span>
          <input
            name="creditLimit"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="No limit"
            defaultValue={customer?.creditLimit ?? ""}
          />
          <small className="field-hint">Leave blank when this customer has no fixed limit.</small>
          <FieldError state={state} name="creditLimit" />
        </label>
        <label className="field">
          <span>Preferred language</span>
          <select name="preferredLanguage" defaultValue={customer?.preferredLanguage ?? "EN"}>
            <option value="EN">English</option>
            <option value="SW">Kiswahili</option>
          </select>
          <FieldError state={state} name="preferredLanguage" />
        </label>
      </div>
      <div className="reminder-settings">
        <label className="checkbox-field">
          <input
            name="reminderEnabled"
            type="checkbox"
            defaultChecked={customer?.reminderEnabled ?? true}
          />
          <span>
            <strong>Enable reminders</strong>
            <small>Allow automatic payment reminders for this customer.</small>
          </span>
        </label>
        <label className="field compact-field">
          <span>Reminder frequency</span>
          <select name="reminderFrequency" defaultValue={String(customer?.reminderFrequency ?? 7)}>
            <option value="1">Every day</option>
            <option value="3">Every 3 days</option>
            <option value="7">Every 7 days</option>
            <option value="14">Every 14 days</option>
            <option value="30">Every 30 days</option>
          </select>
          <FieldError state={state} name="reminderFrequency" />
        </label>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea
          name="notes"
          placeholder="Anything useful to remember about this customer"
          defaultValue={customer?.notes ?? ""}
        />
        <FieldError state={state} name="notes" />
      </label>
      <div className="form-actions">
        <FormSubmitButton pendingLabel={customer ? "Saving changes…" : "Adding customer…"}>
          {customer ? "Save changes" : "Add customer"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
