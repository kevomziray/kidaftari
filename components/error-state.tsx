"use client";

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the problem continues, contact support.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <section className="error-state" role="alert">
      <div className="error-icon">!</div>
      <h1>{title}</h1>
      <p>{description}</p>
      {onRetry ? (
        <button className="btn-primary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </section>
  );
}
