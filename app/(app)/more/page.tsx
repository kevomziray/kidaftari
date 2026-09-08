import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireActor } from "@/lib/tenant";
import { signOutAction } from "@/app/actions/auth";

export default async function MorePage() {
  const actor = await requireActor();
  const links =
    actor.user.role === "OWNER"
      ? [
          ["Reminders", "Configure and review customer reminders", "/reminders"],
          ["Reports", "See simple business totals", "/reports"],
          ["Settings", "Manage your business details and SMS preferences", "/settings"],
          ["Staff", "Add staff and manage access", "/staff"],
        ]
      : [];
  return (
    <>
      <PageHeader
        title="More"
        description={`Signed in as ${actor.user.name} · ${actor.user.role.toLowerCase()}`}
      />
      <div className="customer-cards">
        {links.map(([title, description, href]) => (
          <Link href={href} key={href}>
            <Card className="more-card">
              <h2>{title}</h2>
              <p>{description}</p>
              <span>Open →</span>
            </Card>
          </Link>
        ))}
      </div>
      <form action={signOutAction} className="mt-6">
        <button className="btn-secondary">Sign out</button>
      </form>
    </>
  );
}
