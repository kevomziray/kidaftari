import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <>
      <h1>Start your credit notebook</h1>
      <p>Set up your business in a minute. No accounting experience needed.</p>
      <RegisterForm />
    </>
  );
}
