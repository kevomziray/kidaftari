"use client";

import { useActionState } from "react";
import { createStaffAction } from "@/app/actions/business";
import { updateStaffAccessAction } from "@/app/actions/staff";
import { ActionMessage, FieldError } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

export function CreateStaffForm() {
  const [state, action] = useActionState(createStaffAction, {} as ActionState);
  return (
    <form action={action} className="auth-form">
      <h2>Add a staff member</h2>
      <ActionMessage state={state} />
      <input type="hidden" name="role" value="STAFF" />
      <label className="field">
        <span>Full name</span>
        <input name="name" maxLength={160} required />
        <FieldError state={state} name="name" />
      </label>
      <label className="field">
        <span>Phone or email</span>
        <input name="identifier" maxLength={320} autoComplete="off" required />
        <FieldError state={state} name="identifier" />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          minLength={10}
          maxLength={72}
          autoComplete="new-password"
          required
        />
        <FieldError state={state} name="password" />
      </label>
      <p className="row-subtitle">
        Staff can add customers, record credit and payments, and view history. Reversals are off by
        default.
      </p>
      <FormSubmitButton pendingLabel="Adding…">Add staff member</FormSubmitButton>
    </form>
  );
}

export function StaffAccessForm({
  staff,
}: {
  staff: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    active: boolean;
    canReverseTransactions: boolean;
  };
}) {
  const [state, action] = useActionState(updateStaffAccessAction, {} as ActionState);
  return (
    <form action={action} className="auth-form">
      <h3>{staff.name}</h3>
      <p>{staff.email ?? staff.phone}</p>
      <ActionMessage state={state} />
      <input type="hidden" name="userId" value={staff.id} />
      <label className="field">
        <span>Account access</span>
        <select name="active" defaultValue={String(staff.active)}>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
      </label>
      <label className="field">
        <span>Transaction reversal permission</span>
        <select name="canReverseTransactions" defaultValue={String(staff.canReverseTransactions)}>
          <option value="false">Not allowed</option>
          <option value="true">Explicitly allow reversals</option>
        </select>
      </label>
      <FormSubmitButton pendingLabel="Saving…">Save access</FormSubmitButton>
    </form>
  );
}
