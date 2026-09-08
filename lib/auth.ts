import "server-only";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  hashToken,
  isSessionToken,
  SESSION_COOKIE,
  SESSION_IDLE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-token";

export async function revokeCurrentSession(tx: Prisma.TransactionClient = prisma) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && isSessionToken(token)) {
    await tx.userSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  store.delete("kidaftari_business");
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !isSessionToken(token)) return null;
  const now = Date.now();
  const idleSince = new Date(now - SESSION_IDLE_SECONDS * 1000);
  const session = await prisma.userSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date(now) },
      createdAt: { gt: new Date(now - SESSION_MAX_AGE_SECONDS * 1000) },
      OR: [{ lastUsedAt: { gt: idleSince } }, { lastUsedAt: null, createdAt: { gt: idleSince } }],
      user: { active: true, business: { active: true } },
    },
    select: { id: true, userId: true, lastUsedAt: true },
  });
  if (!session) return null;
  if (!session.lastUsedAt || session.lastUsedAt.getTime() < now - 5 * 60 * 1000) {
    const touched = await prisma.userSession.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date(now) } },
      data: { lastUsedAt: new Date(now) },
    });
    if (!touched.count) return null;
  }
  return session;
}

export async function destroySession() {
  // A failed server revocation must not be reported as a successful logout.
  await revokeCurrentSession();
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete("kidaftari_business");
}
