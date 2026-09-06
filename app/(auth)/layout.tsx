import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <Link href="/" className="auth-brand">
          <span className="brand-mark">K</span>
          <span>KIDAFTARI</span>
        </Link>
        {children}
      </section>
    </main>
  );
}
