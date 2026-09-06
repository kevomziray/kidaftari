"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { recordCreditAction, recordPaymentAction } from "@/app/actions/ledger";
import { ActionMessage, FieldError } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { formatTzs } from "@/lib/formatters";
import type { ActionState } from "@/lib/validation";

type CustomerOption = { id: string; fullName: string; balanceTzs: number };
const initialState: ActionState = {};

function useSubmissionId() {
  const [id, setId] = useState("");
  useEffect(() => setId(globalThis.crypto?.randomUUID?.() ?? ""), []);
  return id;
}

function CustomerSelect({
  customers,
  customerId,
  setCustomerId,
  state,
}: {
  customers: CustomerOption[];
  customerId: string;
  setCustomerId: (value: string) => void;
  state: ActionState;
}) {
  return (
    <label className="field">
      <span>Customer *</span>
      <select
        name="customerId"
        value={customerId}
        onChange={(event) => setCustomerId(event.target.value)}
        required
      >
        <option value="">Choose customer</option>
        {customers.map((customer) => (
          <option value={customer.id} key={customer.id}>
            {customer.fullName} — {formatTzs(customer.balanceTzs)}
          </option>
        ))}
      </select>
      <FieldError state={state} name="customerId" />
    </label>
  );
}

export function CreditForm({
  customers,
  initialCustomerId,
  defaultDueDate,
}: {
  customers: CustomerOption[];
  initialCustomerId: string;
  defaultDueDate: string;
}) {
  const [state, formAction] = useActionState(recordCreditAction, initialState);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [amount, setAmount] = useState("");
  const id = useSubmissionId();
  const selected = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customers, customerId],
  );
  const newBalance = (selected?.balanceTzs ?? 0) + (Number(amount) || 0);
  return (
    <form action={formAction} className="form-card">
      <ActionMessage state={state} />
      <CustomerSelect
        customers={customers}
        customerId={customerId}
        setCustomerId={setCustomerId}
        state={state}
      />
      <div className="form-grid">
        <label className="field">
          <span>Credit amount (TZS) *</span>
          <input
            name="amountTzs"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="e.g. 25000"
            required
          />
          <FieldError state={state} name="amountTzs" />
        </label>
        <label className="field">
          <span>Due date *</span>
          <input name="dueDate" type="date" defaultValue={defaultDueDate} required />
          <FieldError state={state} name="dueDate" />
        </label>
      </div>
      <div className="balance-preview">
        <span>Customer&apos;s new balance</span>
        <strong>{formatTzs(newBalance)}</strong>
      </div>
      <label className="field">
        <span>What did they take?</span>
        <textarea
          name="description"
          maxLength={1000}
          placeholder="e.g. 2 bags of rice (optional)"
        />
        <FieldError state={state} name="description" />
      </label>
      <input type="hidden" name="submissionId" value={id} />
      <p className="notice">
        KIDAFTARI will schedule a reminder for this credit. You can correct an error later by
        reversing it; it is never deleted.
      </p>
      <div className="form-actions">
        <FormSubmitButton pendingLabel="Recording credit…">Record credit</FormSubmitButton>
      </div>
    </form>
  );
}

export function PaymentForm({
  customers,
  initialCustomerId,
  today,
}: {
  customers: CustomerOption[];
  initialCustomerId: string;
  today: string;
}) {
  const [state, formAction] = useActionState(recordPaymentAction, initialState);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [amount, setAmount] = useState("");
  const id = useSubmissionId();
  const selected = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customers, customerId],
  );
  const outstanding = selected?.balanceTzs ?? 0;
  const entered = Number(amount) || 0;
  const remaining = outstanding - entered;
  return (
    <form action={formAction} className="form-card">
      <ActionMessage state={state} />
      <CustomerSelect
        customers={customers}
        customerId={customerId}
        setCustomerId={setCustomerId}
        state={state}
      />
      <div className="form-grid">
        <label className="field">
          <span>Payment amount (TZS) *</span>
          <input
            name="amountTzs"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="e.g. 25000"
            required
          />
          <FieldError state={state} name="amountTzs" />
        </label>
        <label className="field">
          <span>Date received *</span>
          <input name="occurredAt" type="date" defaultValue={today} required />
          <FieldError state={state} name="occurredAt" />
        </label>
      </div>
      <div className="balance-preview">
        <span>Current balance: {formatTzs(outstanding)}</span>
        <strong className={remaining < 0 ? "preview-negative" : ""}>
          Balance after payment: {formatTzs(remaining)}
        </strong>
      </div>
      {remaining < 0 ? (
        <p className="field-error">Payments cannot be greater than the outstanding balance.</p>
      ) : null}
      <div className="form-grid">
        <label className="field">
          <span>How did they pay?</span>
          <select name="paymentMethod" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="MOBILE_MONEY">Mobile money</option>
            <option value="BANK">Bank</option>
            <option value="OTHER">Other</option>
          </select>
          <FieldError state={state} name="paymentMethod" />
        </label>
        <label className="field">
          <span>Reference</span>
          <input
            name="paymentReference"
            maxLength={120}
            placeholder="e.g. M-Pesa code (optional)"
          />
          <FieldError state={state} name="paymentReference" />
        </label>
      </div>
      <label className="field">
        <span>Note</span>
        <textarea name="description" maxLength={1000} placeholder="Optional note" />
        <FieldError state={state} name="description" />
      </label>
      <input type="hidden" name="submissionId" value={id} />
      <p className="notice">
        When a valid mobile number exists, KIDAFTARI queues a payment confirmation SMS
        automatically.
      </p>
      <div className="form-actions">
        <FormSubmitButton pendingLabel="Recording payment…">Record payment</FormSubmitButton>
      </div>
    </form>
  );
}
