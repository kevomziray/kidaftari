import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/tenant";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { signOutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const actor = await requireActor({ allowIncomplete: true });
  if (actor.business.onboardingCompletedAt) redirect("/dashboard");
  if (actor.user.role !== "OWNER")
    return (
      <>
        <h1>Your business is being set up</h1>
        <p>Ask the owner to finish business setup before you start.</p>
        <form action={signOutAction}>
          <button className="btn-secondary">Sign out</button>
        </form>
      </>
    );
  const requested = Number((await searchParams).step);
  const step =
    Number.isInteger(requested) && requested >= 1 && requested <= actor.business.onboardingStep
      ? requested
      : actor.business.onboardingStep;
  return (
    <>
      <p className="eyebrow">Step {step} of 5</p>
      <progress value={step} max={5} aria-label="Business setup progress" className="w-full" />
      <OnboardingForm
        key={step}
        step={step}
        business={{
          businessName: actor.business.businessName,
          businessPhone: actor.business.businessPhone ?? "",
          address: actor.business.address ?? "",
          language: actor.business.language,
          remindersEnabled: actor.business.remindersEnabled,
        }}
      />
      <div className="mt-6 flex items-center justify-between">
        {step > 1 ? <Link href={`/onboarding?step=${step - 1}`}>← Back</Link> : <span />}
        <form action={signOutAction}>
          <button className="text-button">Sign out</button>
        </form>
      </div>
    </>
  );
}
