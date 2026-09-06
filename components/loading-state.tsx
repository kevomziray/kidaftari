export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-state" aria-busy="true">
      <span className="loading-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
