"use client";

import { ErrorState } from "@/components/error-state";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="We could not load your notebook"
      description="Please try again. No credit or payment was changed."
      onRetry={reset}
    />
  );
}
