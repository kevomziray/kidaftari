import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { t } from "@/lib/i18n";
import type { Locale, UserRole } from "@prisma/client";

const nav = [
  { href: "/dashboard", icon: "⌂", key: "dashboard" as const },
  { href: "/customers", icon: "♙", key: "customers" as const },
];

export function AppShell({
  children,
  businessName,
  userName,
  locale,
  role,
}: {
  children: React.ReactNode;
  businessName: string;
  userName: string;
  locale: Locale;
  role: UserRole;
}) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="KIDAFTARI home">
          <span className="brand-mark">K</span>
          <span>KIDAFTARI</span>
        </Link>
        <p className="business-name">{businessName}</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              <span>{item.icon}</span>
              {t(locale, item.key)}
            </Link>
          ))}
          {role === "OWNER" ? (
            <>
              <Link href="/reports">
                <span>▥</span>Reports
              </Link>
              <Link href="/reminders">
                <span>✉</span>Reminders
              </Link>
              <Link href="/staff">
                <span>♙</span>Staff
              </Link>
            </>
          ) : null}
          <Link href="/more">
            <span>•••</span>
            {t(locale, "more")}
          </Link>
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{userName}</strong>
            <small>{role.toLowerCase()}</small>
          </div>
          <form action={signOutAction}>
            <button className="text-button" title="Sign out" aria-label="Sign out">
              ↪
            </button>
          </form>
        </div>
      </aside>
      <main className="main-content">
        <header className="app-topbar">
          <div>
            <span className="app-topbar-mobile-brand">
              <span className="brand-mark">K</span>KIDAFTARI
            </span>
            <small>{businessName} · Your Digital Credit Notebook</small>
          </div>
          <div className="app-topbar-actions">
            <Link className="btn-primary" href="/credits/new">
              + Record credit
            </Link>
          </div>
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <span>{item.icon}</span>
            {t(locale, item.key)}
          </Link>
        ))}
        <Link href="/customers/new" className="mobile-add" aria-label="Add customer">
          +
        </Link>
        <Link href="/more">
          <span>•••</span>
          {t(locale, "more")}
        </Link>
      </nav>
    </div>
  );
}
