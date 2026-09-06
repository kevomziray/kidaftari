export function FlashMessage({
  message,
  tone = "success",
}: {
  message?: string;
  tone?: "success" | "info" | "warning";
}) {
  if (!message) return null;
  return (
    <div className={`flash flash-${tone}`} role="status">
      {message}
    </div>
  );
}
