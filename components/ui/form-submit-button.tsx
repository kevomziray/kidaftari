"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn-primary ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
