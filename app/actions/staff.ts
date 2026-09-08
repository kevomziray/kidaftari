"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertSameOrigin } from "@/lib/csrf";
import { requireActor } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidState, type ActionState } from "@/lib/validation";

const accessSchema = z.object({
  userId: z.string().uuid(),
  active: z.enum(["true", "false"]),
  canReverseTransactions: z.enum(["true", "false"]),
});

export async function updateStaffAccessAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  if (!can(actor.user.role, "manage_staff")) return { message: "Only the owner can manage staff." };
  const parsed = accessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await prisma.$transaction(async (tx) => {
      const staff = await tx.user.findFirst({
        where: { id: parsed.data.userId, businessId: actor.business.id, role: "STAFF" },
        select: { id: true, active: true, canReverseTransactions: true },
      });
      if (!staff) throw new Error("Staff member not found.");
      const access = {
        active: parsed.data.active === "true",
        canReverseTransactions: parsed.data.canReverseTransactions === "true",
      };
      const updated = await tx.user.updateMany({
        where: { id: staff.id, businessId: actor.business.id, role: "STAFF" },
        data: access,
      });
      if (!updated.count) throw new Error("Staff member not found.");
      await tx.userSession.updateMany({
        where: { userId: staff.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAuditLog(
        {
          businessId: actor.business.id,
          actorId: actor.user.id,
          action: "STAFF_ACCESS_UPDATED",
          entityType: "User",
          entityId: staff.id,
          description: "Staff access updated; sessions revoked.",
          beforeData: {
            active: staff.active,
            canReverseTransactions: staff.canReverseTransactions,
          },
          afterData: access,
        },
        tx,
      );
    });
  } catch {
    return { message: "Could not update this staff member. Refresh and try again." };
  }
  revalidatePath("/staff");
  return { success: true, message: "Access saved. This staff member must sign in again." };
}
