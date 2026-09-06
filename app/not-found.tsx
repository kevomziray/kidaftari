import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <div className="empty-icon" aria-hidden="true">
          ?
        </div>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or may have moved.</p>
        <Link className="btn-primary" href="/">
          Go to KIDAFTARI home
        </Link>
      </section>
    </main>
  );
}
