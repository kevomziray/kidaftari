import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "kidaftari_session";
const ACTIVE_BUSINESS_COOKIE = "kidaftari_business";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const secureCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.userSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, { ...secureCookie, expires: expiresAt });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.userSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { active: true },
    },
    include: { user: true },
  });
  if (!session) return null;

  void prisma.userSession
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return session;
}

export async function setActiveBusiness(businessId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    ...secureCookie,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getActiveBusinessId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.userSession
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ACTIVE_BUSINESS_COOKIE);
}
