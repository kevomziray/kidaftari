"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, signInAction } from "@/app/actions/auth";
import { ActionMessage, FieldError } from "@/components/ui/action-message";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState);
  return (
    <form action={formAction} className="auth-form">
      <ActionMessage state={state} />
      <label className="field">
        <span>Phone or email</span>
        <input
          name="identifier"
          type="text"
          autoComplete="username"
          maxLength={320}
          placeholder="0712 345 678 or you@example.com"
          required
        />
        <FieldError state={state} name="identifier" />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
        />
        <FieldError state={state} name="password" />
      </label>
      <FormSubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </FormSubmitButton>
      <p className="auth-switch">
        New to KIDAFTARI? <Link href="/register">Create your account</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);
  return (
    <form action={formAction} className="auth-form">
      <ActionMessage state={state} />
      <label className="field">
        <span>Full name</span>
        <input
          name="name"
          autoComplete="name"
          maxLength={160}
          placeholder="e.g. Asha Mussa"
          required
        />
        <FieldError state={state} name="name" />
      </label>
      <label className="field">
        <span>Business name</span>
        <input
          name="businessName"
          autoComplete="organization"
          maxLength={160}
          placeholder="e.g. Asha General Store"
          required
        />
        <FieldError state={state} name="businessName" />
      </label>
      <label className="field">
        <span>Phone or email</span>
        <input
          name="identifier"
          type="text"
          autoComplete="username"
          maxLength={320}
          placeholder="0712 345 678 or you@example.com"
          required
        />
        <FieldError state={state} name="identifier" />
      </label>
      <label className="field">
        <span>Business phone</span>
        <input
          name="businessPhone"
          type="tel"
          autoComplete="tel"
          maxLength={32}
          placeholder="0712 345 678"
          required
        />
        <FieldError state={state} name="businessPhone" />
      </label>
      <label className="field">
        <span>Create a password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={72}
          placeholder="At least 10 characters"
          required
        />
        <FieldError state={state} name="password" />
      </label>
      <FormSubmitButton pendingLabel="Creating your account…" className="w-full">
        Create business account
      </FormSubmitButton>
      <p className="auth-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
