import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

const links = [
  ["Reminders", "Configure and review customer reminders", "/reminders"],
  ["Reports", "See simple business totals", "/reports"],
  ["Settings", "Manage your business details", "/settings"],
] as const;

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" description="Other parts of your KIDAFTARI notebook." />
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
    </>
  );
}
