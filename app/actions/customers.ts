"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeTanzanianPhone } from "@/lib/security";
import { requireActor } from "@/lib/tenant";
import { customerSchema, invalidState, type ActionState } from "@/lib/validation";

export async function createCustomerAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "manage_customers");
  const defaultDueRaw = String(formData.get("defaultDueDays") ?? "").trim();
  const parsed = customerSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    defaultDueDays: defaultDueRaw || undefined,
  });
  if (!parsed.success) return invalidState(parsed.error);

  let phone: string | null = null;
  if (parsed.data.phone) {
    try {
      phone = normalizeTanzanianPhone(parsed.data.phone);
    } catch (error) {
      return { message: error instanceof Error ? error.message : "Enter a valid phone number." };
    }
  }

  const customer = await prisma.$transaction(async (tx) => {
    const result = await tx.customer.create({
      data: {
        businessId: actor.business.id,
        customerNumber: `CUS-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        fullName: parsed.data.fullName,
        phone,
        normalizedPhone: phone,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
        defaultDueDays: parsed.data.defaultDueDays,
        createdById: actor.user.id,
        updatedById: actor.user.id,
      },
    });
    await writeAuditLog(
      {
        businessId: actor.business.id,
        actorId: actor.user.id,
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: result.id,
        description: "Customer created.",
        afterData: { fullName: result.fullName, phone: result.phone },
      },
      tx,
    );
    return result;
  });

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}?created=1`);
}

export async function archiveCustomerAction(customerId: string) {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "manage_customers");
  const customer = await prisma.customer.updateMany({
    where: { id: customerId, businessId: actor.business.id, active: true },
    data: { active: false, archivedAt: new Date(), updatedById: actor.user.id },
  });
  if (!customer.count) throw new Error("Customer was not found.");
  await writeAuditLog({
    businessId: actor.business.id,
    actorId: actor.user.id,
    action: "CUSTOMER_ARCHIVED",
    entityType: "Customer",
    entityId: customerId,
    description: "Customer archived; financial history remains available.",
  });
  revalidatePath("/customers");
  redirect("/customers?archived=1");
}
