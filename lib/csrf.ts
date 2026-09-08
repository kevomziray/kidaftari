import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";

/** Server Actions already enforce origin checks; this keeps the policy explicit for future route handlers. */
export async function assertSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (!origin || requestHeaders.get("sec-fetch-site") === "cross-site") {
    throw new Error("This request was blocked. Refresh the page and try again.");
  }
  const { APP_ORIGIN: allowedOrigins } = getServerEnv();
  if (!allowedOrigins.includes(origin.replace(/\/$/, ""))) {
    throw new Error("This request was blocked because it came from an untrusted origin.");
  }
}
