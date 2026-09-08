import Link from "next/link";
import { requireActor } from "@/lib/tenant";
import { signOutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  await requireActor({ allowIncomplete: true });
  return (
    <>
      <h1>Access restricted</h1>
      <p>
        Your account does not have permission to open this page. Contact your business owner if you
        need access.
      </p>
      <Link href="/dashboard" className="btn-primary">
        Back to dashboard
      </Link>
      <form action={signOutAction} className="mt-6">
        <button className="text-button">Sign out</button>
      </form>
    </>
  );
}
