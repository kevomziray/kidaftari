"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeTanzanianPhone } from "@/lib/security";
import { requireActor } from "@/lib/tenant";
import { customerSchema, invalidState, type ActionState } from "@/lib/validation";

class CustomerActionError extends Error {}

function parseCustomer(formData: FormData) {
  return customerSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    alternativePhone: formData.get("alternativePhone"),
    address: formData.get("address"),
    creditLimit: formData.get("creditLimit"),
    reminderEnabled: formData.get("reminderEnabled") === "on",
    reminderFrequency: formData.get("reminderFrequency"),
    preferredLanguage: formData.get("preferredLanguage"),
    notes: formData.get("notes"),
  });
}

function phones(data: { phone: string; alternativePhone?: string }) {
  try {
    return {
      phone: normalizeTanzanianPhone(data.phone),
      alternativePhone: data.alternativePhone
        ? normalizeTanzanianPhone(data.alternativePhone)
        : null,
    };
  } catch (error) {
    throw new CustomerActionError(
      error instanceof Error ? error.message : "Enter a valid phone number.",
    );
  }
}

function actionError(error: unknown): ActionState {
  console.error("Customer action failed", error);
  return {
    message:
      error instanceof CustomerActionError
        ? error.message
        : "We could not save this customer. Please try again.",
  };
}

export async function createCustomerAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "add_customers");
  const parsed = parseCustomer(formData);
  if (!parsed.success) return invalidState(parsed.error);

  let normalized: ReturnType<typeof phones>;
  try {
    normalized = phones(parsed.data);
  } catch (error) {
    return actionError(error);
  }

  let customerId: string;
  try {
    const customer = await prisma.$transaction(async (tx) => {
      const business = await tx.business.update({
        where: { id: actor.business.id },
        data: { nextCustomerNumber: { increment: 1 } },
        select: { nextCustomerNumber: true },
      });
      const sequence = business.nextCustomerNumber - 1;
      if (sequence > 999999)
        throw new CustomerActionError("Customer number limit has been reached.");
      const result = await tx.customer.create({
        data: {
          businessId: actor.business.id,
          customerNumber: `KDF-${String(sequence).padStart(6, "0")}`,
          fullName: parsed.data.fullName,
          phone: normalized.phone,
          normalizedPhone: normalized.phone,
          alternativePhone: normalized.alternativePhone,
          address: parsed.data.address || null,
          creditLimit: parsed.data.creditLimit ?? null,
          reminderEnabled: parsed.data.reminderEnabled,
          reminderFrequency: parsed.data.reminderFrequency,
          preferredLanguage: parsed.data.preferredLanguage,
          notes: parsed.data.notes || null,
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
          afterData: {
            customerNumber: result.customerNumber,
            fullName: result.fullName,
            phone: result.phone,
          },
        },
        tx,
      );
      return result;
    });

    customerId = customer.id;
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  redirect(`/customers/${customerId}?created=1`);
}

export async function updateCustomerAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "manage_customers");
  const customerId = String(formData.get("customerId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return { message: "Customer was not found." };
  const parsed = parseCustomer(formData);
  if (!parsed.success) return invalidState(parsed.error);

  let normalized: ReturnType<typeof phones>;
  try {
    normalized = phones(parsed.data);
  } catch (error) {
    return actionError(error);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.customer.findFirst({
        where: { id: customerId, businessId: actor.business.id, active: true },
      });
      if (!before) throw new CustomerActionError("Customer was not found or is inactive.");
      const changed = await tx.customer.updateMany({
        where: { id: customerId, businessId: actor.business.id, active: true },
        data: {
          fullName: parsed.data.fullName,
          phone: normalized.phone,
          normalizedPhone: normalized.phone,
          alternativePhone: normalized.alternativePhone,
          address: parsed.data.address || null,
          creditLimit: parsed.data.creditLimit ?? null,
          reminderEnabled: parsed.data.reminderEnabled,
          reminderFrequency: parsed.data.reminderFrequency,
          preferredLanguage: parsed.data.preferredLanguage,
          notes: parsed.data.notes || null,
          updatedById: actor.user.id,
        },
      });
      if (!changed.count) throw new CustomerActionError("Customer was not found or is inactive.");
      await writeAuditLog(
        {
          businessId: actor.business.id,
          actorId: actor.user.id,
          action: "CUSTOMER_UPDATED",
          entityType: "Customer",
          entityId: customerId,
          description: "Customer details updated.",
          beforeData: {
            fullName: before.fullName,
            phone: before.phone,
            creditLimit: before.creditLimit,
          },
          afterData: {
            fullName: parsed.data.fullName,
            phone: normalized.phone,
            creditLimit: parsed.data.creditLimit ?? null,
          },
        },
        tx,
      );
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?updated=1`);
}

export async function archiveCustomerAction(customerId: string) {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "manage_customers");
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, businessId: actor.business.id, active: true },
      select: {
        id: true,
        fullName: true,
        _count: { select: { creditTransactions: true, payments: true } },
      },
    });
    if (!customer) throw new Error("Customer was not found.");
    const changed = await tx.customer.updateMany({
      where: { id: customerId, businessId: actor.business.id, active: true },
      data: { active: false, archivedAt: new Date(), updatedById: actor.user.id },
    });
    if (!changed.count) throw new Error("Customer was not found.");
    await writeAuditLog(
      {
        businessId: actor.business.id,
        actorId: actor.user.id,
        action: "CUSTOMER_ARCHIVED",
        entityType: "Customer",
        entityId: customerId,
        description: "Customer deactivated; financial history remains preserved.",
        metadata: {
          creditTransactions: customer._count.creditTransactions,
          payments: customer._count.payments,
        },
      },
      tx,
    );
  });
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  redirect("/customers?deactivated=1");
}
