import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env";

/** A single Postgres upsert serializes concurrent attempts across app instances. */
export async function consumeAuthLimit(key: string, limit: number, windowSeconds: number) {
  const keyHash = createHmac("sha256", getServerEnv().AUTH_SECRET).update(key).digest("hex");
  const [row] = await prisma.$queryRaw<{ count: number; retryAfterSeconds: number }[]>`
    INSERT INTO "AuthRateLimit" ("key", "count", "resetAt")
    VALUES (${keyHash}, 1, CURRENT_TIMESTAMP + ${windowSeconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthRateLimit"."resetAt" <= CURRENT_TIMESTAMP THEN 1
                    ELSE LEAST("AuthRateLimit"."count" + 1, ${limit + 1}) END,
      "resetAt" = CASE WHEN "AuthRateLimit"."resetAt" <= CURRENT_TIMESTAMP
                      THEN CURRENT_TIMESTAMP + ${windowSeconds} * INTERVAL '1 second'
                      ELSE "AuthRateLimit"."resetAt" END
    RETURNING "count", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - CURRENT_TIMESTAMP))))::int AS "retryAfterSeconds"
  `;
  if (!row) throw new Error("Authentication throttle unavailable.");
  return { allowed: row.count <= limit, retryAfterSeconds: row.retryAfterSeconds };
}

export async function checkAuthRateLimit(kind: "signin" | "register", identifier: string) {
  const seconds = kind === "signin" ? 15 * 60 : 60 * 60;
  // A shared ceiling also limits identifier spraying, without trusting spoofable IP headers.
  const global = await consumeAuthLimit(`${kind}:global`, kind === "signin" ? 300 : 30, seconds);
  if (!global.allowed) return global;
  await prisma.$executeRaw`
    DELETE FROM "AuthRateLimit" WHERE "key" IN
      (SELECT "key" FROM "AuthRateLimit" WHERE "resetAt" < CURRENT_TIMESTAMP LIMIT 100)
  `;
  return consumeAuthLimit(`${kind}:identifier:${identifier}`, kind === "signin" ? 10 : 5, seconds);
}
