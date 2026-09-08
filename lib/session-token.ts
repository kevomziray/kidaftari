import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "kidaftari_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_IDLE_SECONDS = 60 * 60 * 24;
export const isSessionToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newSession() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    lastUsedAt: new Date(),
  };
}
