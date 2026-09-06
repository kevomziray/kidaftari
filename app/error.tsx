"use client";

import { ErrorState } from "@/components/error-state";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-layout">
      <ErrorState
        title="KIDAFTARI needs another try"
        description="We could not load this page safely. Your information has not been changed."
        onRetry={reset}
      />
    </main>
  );
}
