"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { createSession, destroySession, getSession, setActiveBusiness } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/security";
import { invalidState, registerSchema, signInSchema, type ActionState } from "@/lib/validation";

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertSameOrigin();
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: formData.get("password"),
    businessName: formData.get("businessName"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  const limit = checkRateLimit(`register:${parsed.data.email}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) return { message: `Please try again in ${limit.retryAfterSeconds} seconds.` };

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { businessName: parsed.data.businessName },
      });
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: "OWNER",
        },
      });
      await writeAuditLog(
        {
          businessId: business.id,
          actorId: user.id,
          action: "BUSINESS_CREATED",
          entityType: "Business",
          entityId: business.id,
          description: "Business created during registration.",
          afterData: { businessName: business.businessName },
        },
        tx,
      );
      return { user, business };
    });
    await createSession(result.user.id);
    await setActiveBusiness(result.business.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "An account with that email already exists. Please sign in instead." };
    }
    console.error("Registration failed", error);
    return { message: "We could not create your account. Please try again." };
  }
  redirect("/dashboard?welcome=1");
}

export async function signInAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertSameOrigin();
  const parsed = signInSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: formData.get("password"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  const limit = checkRateLimit(`signin:${parsed.data.email}`, 10, 15 * 60 * 1000);
  if (!limit.allowed)
    return { message: `Too many attempts. Please wait ${limit.retryAfterSeconds} seconds.` };

  const user = await prisma.user.findFirst({
    where: { email: parsed.data.email, active: true, business: { active: true } },
    include: { business: true },
  });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { message: "Email or password is incorrect." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  await setActiveBusiness(user.businessId);
  redirect("/dashboard");
}

export async function signOutAction() {
  await assertSameOrigin();
  await destroySession();
  redirect("/sign-in");
}

export async function switchBusinessAction(formData: FormData) {
  await assertSameOrigin();
  const businessId = String(formData.get("businessId") ?? "");
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const user = await prisma.user.findFirst({
    where: { id: session.userId, businessId, active: true, business: { active: true } },
  });
  if (!user) throw new Error("You do not have access to this business.");
  await setActiveBusiness(businessId);
  redirect("/dashboard");
}
