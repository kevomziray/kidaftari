import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Add Customer",
    text: "Save a customer name and mobile number in seconds.",
  },
  { number: "02", title: "Record Credit", text: "Write down what they took and when it is due." },
  { number: "03", title: "Track Balance", text: "Always see the exact amount each customer owes." },
  {
    number: "04",
    title: "Send Automatic Reminder",
    text: "Remind customers politely when a balance is due.",
  },
  {
    number: "05",
    title: "Record Payment",
    text: "Record payment and keep the balance up to date.",
  },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link href="/" className="landing-brand">
          <span className="brand-mark">K</span>
          <span>KIDAFTARI</span>
        </Link>
        <div className="landing-nav-actions">
          <Link className="landing-login" href="/login">
            Sign in
          </Link>
          <Link className="btn-primary" href="/register">
            Start Free
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR DIGITAL CREDIT NOTEBOOK</p>
          <h1>
            KIDAFTARI — <span>Your Digital Credit Notebook</span>
          </h1>
          <p className="hero-description">
            Record credit, track balances and automatically remind customers to pay.
          </p>
          <div className="hero-actions">
            <Link className="btn-primary hero-primary" href="/register">
              Start Free <span aria-hidden="true">→</span>
            </Link>
            <Link className="btn-secondary hero-secondary" href="#how-it-works">
              See How It Works
            </Link>
          </div>
          <p className="hero-note">Simple enough for every shop. Built for Tanzania.</p>
        </div>
        <div className="hero-visual" aria-label="Example KIDAFTARI dashboard">
          <div className="visual-top">
            <span className="visual-brand">
              <i>K</i> KIDAFTARI
            </span>
            <span className="visual-date">Today</span>
          </div>
          <div className="visual-balance">
            <span>Customers owe you</span>
            <strong>TZS 1,245,000</strong>
            <small>12 customers with active credit</small>
          </div>
          <div className="visual-actions">
            <span>+ Add customer</span>
            <span>+ Record credit</span>
            <span>+ Record payment</span>
          </div>
          <div className="visual-list">
            <div>
              <b>Neema Juma</b>
              <small>Due today</small>
              <strong>TZS 85,000</strong>
            </div>
            <div>
              <b>Safari Stores</b>
              <small>Overdue</small>
              <strong>TZS 240,000</strong>
            </div>
            <div>
              <b>Juma K.</b>
              <small>Due soon</small>
              <strong>TZS 35,000</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-trust">
        <span>No accounting jargon</span>
        <span>Made for mobile</span>
        <span>Amounts in TZS</span>
        <span>Designed for Tanzania</span>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-intro">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>Five simple steps. No complicated bookkeeping.</h2>
          <p>
            From the first credit sale to the final payment, KIDAFTARI keeps the important things
            clear.
          </p>
        </div>
        <ol className="steps-grid">
          {steps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-cta">
        <div>
          <p className="eyebrow">READY WHEN YOU ARE</p>
          <h2>Know who owes you, and how much.</h2>
          <p>Start your digital credit notebook today.</p>
        </div>
        <Link className="btn-primary" href="/register">
          Start Free <span aria-hidden="true">→</span>
        </Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="landing-brand">
          <span className="brand-mark">K</span>
          <span>KIDAFTARI</span>
        </Link>
        <p>Your Digital Credit Notebook</p>
        <span>© {new Date().getFullYear()} KIDAFTARI</span>
      </footer>
    </main>
  );
}
