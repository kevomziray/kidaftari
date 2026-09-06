import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1>Welcome back</h1>
      <p>Sign in to your KIDAFTARI credit notebook.</p>
      <SignInForm />
    </>
  );
}
