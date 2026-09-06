"use client";

import "@/app/globals.css";
import { ErrorState } from "@/components/error-state";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="auth-layout">
          <ErrorState
            title="KIDAFTARI needs another try"
            description="We could not load the application safely. Please try again."
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  );
}
