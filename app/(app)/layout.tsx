import { AppShell } from "@/components/app-shell";
import { requireActor } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return (
    <AppShell
      businessName={actor.business.businessName}
      userName={actor.user.name}
      locale={actor.business.language}
      role={actor.membership.role}
    >
      {children}
    </AppShell>
  );
}
