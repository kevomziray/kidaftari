"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { destroySession, revokeCurrentSession, setSessionCookie } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit, consumeAuthLimit } from "@/lib/auth-rate-limit";
import { newSession } from "@/lib/session-token";
import { registerSchema, signInSchema } from "@/lib/auth-validation";
import { invalidState, type ActionState } from "@/lib/validation";

// Unknown accounts still perform the same password work as known accounts.
const DUMMY_HASH = bcrypt.hashSync("dummy-account-timing-check", 12);

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertSameOrigin();
    const parsed = registerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalidState(parsed.error);
    const { identifier, password, ...profile } = parsed.data;
    const limit = await checkAuthRateLimit("register", identifier.email ?? identifier.phone!);
    if (!limit.allowed)
      return { message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` };
    const passwordHash = await bcrypt.hash(password, 12);
    const { token, ...sessionData } = newSession();
    await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          businessName: profile.businessName,
          businessPhone: profile.businessPhone,
          remindersEnabled: false,
          sendPaymentConfirmations: false,
        },
      });
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          name: profile.name,
          ...identifier,
          passwordHash,
          role: "OWNER",
          lastLoginAt: new Date(),
        },
      });
      await writeAuditLog(
        {
          businessId: business.id,
          actorId: user.id,
          action: "BUSINESS_CREATED",
          entityType: "Business",
          entityId: business.id,
          description: "Business and owner created during registration.",
        },
        tx,
      );
      await revokeCurrentSession(tx);
      await tx.userSession.create({ data: { userId: user.id, ...sessionData } });
    });
    await setSessionCookie(token, sessionData.expiresAt);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        message:
          "Unable to register with these details. Try signing in or use a different phone or email.",
      };
    }
    // Never expose database errors, credentials, form data or password hashes.
    return {
      message:
        "We could not create your account. Refresh the page and try again. If you already registered, sign in.",
    };
  }
  redirect("/onboarding");
}

export async function signInAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let destination = "/dashboard";
  try {
    await assertSameOrigin();
    const parsed = signInSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalidState(parsed.error);
    const { identifier, password } = parsed.data;
    const limit = await checkAuthRateLimit("signin", identifier.email ?? identifier.phone!);
    if (!limit.allowed)
      return { message: `Too many attempts. Please wait ${limit.retryAfterSeconds} seconds.` };
    const user = await prisma.user.findFirst({
      where: {
        ...(identifier.email ? { email: identifier.email } : { phone: identifier.phone }),
        active: true,
        business: { active: true },
      },
      include: { business: { select: { onboardingCompletedAt: true } } },
    });
    if (user) {
      const accountLimit = await consumeAuthLimit(`signin:user:${user.id}`, 10, 15 * 60);
      if (!accountLimit.allowed)
        return {
          message: `Too many attempts. Please wait ${accountLimit.retryAfterSeconds} seconds.`,
        };
    }
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) return { message: "Phone/email or password is incorrect." };
    const { token, ...sessionData } = newSession();
    await prisma.$transaction(async (tx) => {
      await revokeCurrentSession(tx);
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await tx.userSession.create({ data: { userId: user.id, ...sessionData } });
    });
    await setSessionCookie(token, sessionData.expiresAt);
    if (!user.business.onboardingCompletedAt) destination = "/onboarding";
  } catch {
    return { message: "Sign-in is temporarily unavailable. Refresh the page and try again." };
  }
  redirect(destination);
}

export async function signOutAction() {
  await assertSameOrigin();
  await destroySession();
  redirect("/login");
}
