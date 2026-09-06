"use client";

import { useActionState } from "react";
import { queueManualReminderAction, reverseTransactionAction } from "@/app/actions/ledger";
import { ActionMessage } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function ManualReminderForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState(queueManualReminderAction, initialState);
  return (
    <form action={formAction} className="inline-action-form">
      <input type="hidden" name="customerId" value={customerId} />
      <FormSubmitButton pendingLabel="Queueing…" className="btn-secondary">
        Send reminder
      </FormSubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

export function ReverseTransactionForm({ transactionId }: { transactionId: string }) {
  const [state, formAction] = useActionState(reverseTransactionAction, initialState);
  return (
    <details className="details-form">
      <summary>Reverse this transaction</summary>
      <form action={formAction}>
        <input type="hidden" name="transactionId" value={transactionId} />
        <label className="field">
          <span>Why is this being reversed?</span>
          <textarea
            name="reason"
            maxLength={1000}
            required
            placeholder="e.g. Amount entered by mistake"
          />
        </label>
        <ActionMessage state={state} />
        <FormSubmitButton pendingLabel="Reversing…" className="btn-danger">
          Confirm reversal
        </FormSubmitButton>
      </form>
    </details>
  );
}
