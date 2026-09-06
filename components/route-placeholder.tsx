import Link from "next/link";
import { Card } from "@/components/ui/card";

export function RoutePlaceholder({
  title,
  description,
  primaryAction,
}: {
  title: string;
  description: string;
  primaryAction?: { href: string; label: string };
}) {
  return (
    <Card className="route-placeholder">
      <div className="empty-icon" aria-hidden="true">
        ◌
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {primaryAction ? (
        <Link className="btn-primary" href={primaryAction.href}>
          {primaryAction.label}
        </Link>
      ) : null}
    </Card>
  );
}
