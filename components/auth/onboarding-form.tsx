"use client";

import { useActionState } from "react";
import { saveOnboardingStepAction } from "@/app/actions/onboarding";
import { ActionMessage, FieldError } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

const titles = [
  "",
  "What is your business called?",
  "Your business phone",
  "Where is your business?",
  "Your preferred language",
  "Payment reminders",
];

export function OnboardingForm({
  step,
  business,
}: {
  step: number;
  business: {
    businessName: string;
    businessPhone: string;
    address: string;
    language: "EN" | "SW";
    remindersEnabled: boolean;
  };
}) {
  const [state, action] = useActionState(saveOnboardingStepAction, {} as ActionState);
  return (
    <>
      <h1>{titles[step]}</h1>
      <p>Your progress is saved each time you continue.</p>
      <form action={action} className="auth-form">
        <input type="hidden" name="step" value={step} />
        <ActionMessage state={state} />
        {step === 1 && (
          <label className="field">
            <span>Business name</span>
            <input
              name="businessName"
              defaultValue={business.businessName}
              maxLength={160}
              autoComplete="organization"
              required
              autoFocus
            />
            <FieldError state={state} name="businessName" />
          </label>
        )}
        {step === 2 && (
          <label className="field">
            <span>Business phone</span>
            <input
              name="businessPhone"
              type="tel"
              defaultValue={business.businessPhone}
              maxLength={32}
              autoComplete="tel"
              required
              autoFocus
            />
            <FieldError state={state} name="businessPhone" />
          </label>
        )}
        {step === 3 && (
          <label className="field">
            <span>Business location</span>
            <input
              name="address"
              defaultValue={business.address}
              placeholder="e.g. Kariakoo, Dar es Salaam"
              maxLength={1000}
              autoComplete="street-address"
              required
              autoFocus
            />
            <FieldError state={state} name="address" />
          </label>
        )}
        {step === 4 && (
          <label className="field">
            <span>Preferred language for customer messages</span>
            <select name="language" defaultValue={business.language}>
              <option value="EN">English</option>
              <option value="SW">Kiswahili</option>
            </select>
            <FieldError state={state} name="language" />
          </label>
        )}
        {step === 5 && (
          <label className="field">
            <span>Default reminder preference</span>
            <select name="remindersEnabled" defaultValue={String(business.remindersEnabled)}>
              <option value="false">Off — I will remind customers myself</option>
              <option value="true">On — schedule payment reminders</option>
            </select>
            <small>
              You can change this in Settings. SMS delivery needs a configured provider.
            </small>
            <FieldError state={state} name="remindersEnabled" />
          </label>
        )}
        <FormSubmitButton pendingLabel="Saving…" className="w-full">
          {step === 5 ? "Finish setup" : "Save and continue"}
        </FormSubmitButton>
      </form>
    </>
  );
}
