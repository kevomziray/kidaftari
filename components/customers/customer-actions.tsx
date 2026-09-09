"use client";

import { useActionState } from "react";
import { archiveCustomerAction } from "@/app/actions/customers";
import { queueManualReminderAction, reverseTransactionAction } from "@/app/actions/ledger";
import { ActionMessage } from "@/components/ui/action-message";
import { Dialog } from "@/components/ui/dialog";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function ManualReminderForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState(queueManualReminderAction, initialState);
  return (
    <Dialog trigger="Send reminder" title="Send payment reminder?">
      <p className="dialog-description">
        A reminder will be queued for this customer&apos;s mobile number. No financial record will
        change.
      </p>
      <form action={formAction} className="dialog-actions">
        <input type="hidden" name="customerId" value={customerId} />
        <ActionMessage state={state} />
        <FormSubmitButton pendingLabel="Queueing…">Yes, send reminder</FormSubmitButton>
      </form>
    </Dialog>
  );
}

export function DeactivateCustomerDialog({
  customerId,
  customerName,
  hasTransactions,
}: {
  customerId: string;
  customerName: string;
  hasTransactions: boolean;
}) {
  const action = archiveCustomerAction.bind(null, customerId);
  return (
    <Dialog
      trigger="Deactivate customer"
      triggerClassName="btn-danger"
      title={"Deactivate " + customerName + "?"}
    >
      <p className="dialog-description">
        They will disappear from the active customer list.{" "}
        {hasTransactions
          ? "All credit and payment records will remain available and unchanged."
          : "You can still keep their customer record for audit purposes."}
      </p>
      <form action={action} className="dialog-actions">
        <FormSubmitButton pendingLabel="Deactivating…" className="btn-danger">
          Yes, deactivate customer
        </FormSubmitButton>
      </form>
    </Dialog>
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
