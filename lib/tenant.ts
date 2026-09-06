import { redirect } from "next/navigation";
import { getActiveBusinessId, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentActor() {
  const session = await getSession();
  if (!session) return null;

  const requestedBusinessId = await getActiveBusinessId();
  // A user is assigned to one tenant in Stage 2. Ignore a stale active-business
  // cookie rather than allowing it to select another business by ID.
  if (requestedBusinessId && requestedBusinessId !== session.user.businessId) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      active: true,
      business: { active: true },
    },
    include: { business: true },
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

export async function requireActor() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/sign-in");
  return actor;
}

/** Use before any route accepting an entity ID: the business condition is non-negotiable. */
export function tenantWhere<T extends Record<string, unknown>>(businessId: string, where: T) {
  return { ...where, businessId };
}
