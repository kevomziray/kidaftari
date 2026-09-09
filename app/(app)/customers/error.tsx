"use client";

import { ErrorState } from "@/components/error-state";

export default function CustomersError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="We could not load customers"
      description="Please try again. No customer or financial record was changed."
      onRetry={reset}
    />
  );
}
