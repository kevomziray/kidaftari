"use client";

import { useActionState } from "react";
import { createCustomerAction } from "@/app/actions/customers";
import { ActionMessage, FieldError } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function CustomerForm({ defaultDueDays }: { defaultDueDays: number }) {
  const [state, formAction] = useActionState(createCustomerAction, initialState);
  return (
    <form action={formAction} className="form-card">
      <ActionMessage state={state} />
      <label className="field">
        <span>Customer name *</span>
        <input
          name="fullName"
          autoComplete="name"
          placeholder="e.g. Neema Juma"
          required
          autoFocus
        />
        <FieldError state={state} name="fullName" />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Mobile number</span>
          <input name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" />
          <small className="field-hint">Needed for SMS reminders.</small>
          <FieldError state={state} name="phone" />
        </label>
        <label className="field">
          <span>Email address</span>
          <input name="email" type="email" autoComplete="email" placeholder="Optional" />
          <FieldError state={state} name="email" />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Default payment period (days)</span>
          <input
            name="defaultDueDays"
            type="number"
            min="0"
            max="365"
            defaultValue={defaultDueDays}
          />
          <small className="field-hint">Used when you record credit.</small>
          <FieldError state={state} name="defaultDueDays" />
        </label>
        <label className="field">
          <span>Address</span>
          <input name="address" placeholder="Optional" />
          <FieldError state={state} name="address" />
        </label>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea
          name="notes"
          placeholder="Anything helpful to remember about this customer (optional)"
        />
        <FieldError state={state} name="notes" />
      </label>
      <p className="notice">
        You can add a customer without a phone number, but automatic SMS reminders will need one
        later.
      </p>
      <div className="form-actions">
        <FormSubmitButton pendingLabel="Adding customer…">Add customer</FormSubmitButton>
      </div>
    </form>
  );
}
