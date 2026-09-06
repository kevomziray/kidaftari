import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1>Welcome back</h1>
      <p>Sign in to see who owes you and what they owe.</p>
      <SignInForm />
    </>
  );
}
