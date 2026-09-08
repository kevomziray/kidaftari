import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function getCurrentActor() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      active: true,
      business: { active: true },
    },
    select: {
      id: true,
      businessId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      canReverseTransactions: true,
      business: true,
    },
  });
  if (!user) return null;

  // Kept as a small compatibility shape for existing server actions while role
  // ownership now comes directly from User.role, not a second role table.
  const membership = {
    businessId: user.businessId,
    role: user.role,
    isActive: user.active,
  };
  return { user, membership, business: user.business };
}

export async function requireActor(options: { allowIncomplete?: boolean } = {}) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (!options.allowIncomplete && !actor.business.onboardingCompletedAt) redirect("/onboarding");
  return actor;
}

export async function requirePermission(permission: Permission) {
  const actor = await requireActor();
  if (!can(actor.user.role, permission, actor.user.canReverseTransactions))
    redirect("/access-denied");
  return actor;
}

/** Use before any route accepting an entity ID: the business condition is non-negotiable. */
export function tenantWhere<T extends Record<string, unknown>>(businessId: string, where: T) {
  return { ...where, businessId };
}
