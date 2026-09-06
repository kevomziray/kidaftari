"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizeTanzanianPhone } from "@/lib/security";
import { requireActor } from "@/lib/tenant";
import {
  businessSettingsSchema,
  createStaffSchema,
  invalidState,
  type ActionState,
} from "@/lib/validation";

export async function updateBusinessSettingsAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "manage_business");
  const parsed = businessSettingsSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    locale: formData.get("locale"),
    defaultCreditDueDays: formData.get("defaultCreditDueDays"),
    remindersEnabled: formData.get("remindersEnabled"),
    reminderDaysBeforeDue: formData.get("reminderDaysBeforeDue"),
    overdueReminderIntervalDays: formData.get("overdueReminderIntervalDays"),
    reminderLocalTime: formData.get("reminderLocalTime"),
    sendPaymentConfirmations: formData.get("sendPaymentConfirmations"),
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
  const before = {
    businessName: actor.business.businessName,
    language: actor.business.language,
    remindersEnabled: actor.business.remindersEnabled,
  };
  await prisma.$transaction(async (tx) => {
    const business = await tx.business.update({
      where: { id: actor.business.id },
      data: {
        businessName: parsed.data.name,
        businessPhone: phone,
        businessEmail: parsed.data.email || null,
        address: parsed.data.address || null,
        language: parsed.data.locale,
        defaultCreditDueDays: parsed.data.defaultCreditDueDays,
        remindersEnabled: parsed.data.remindersEnabled,
        reminderDaysBeforeDue: parsed.data.reminderDaysBeforeDue,
        overdueReminderIntervalDays: parsed.data.overdueReminderIntervalDays,
        reminderLocalTime: parsed.data.reminderLocalTime,
        sendPaymentConfirmations: parsed.data.sendPaymentConfirmations,
      },
    });
    await writeAuditLog(
      {
        businessId: actor.business.id,
        actorId: actor.user.id,
        action: "BUSINESS_SETTINGS_UPDATED",
        entityType: "Business",
        entityId: business.id,
        beforeData: before,
        afterData: {
          businessName: business.businessName,
          language: business.language,
          remindersEnabled: business.remindersEnabled,
        },
      },
      tx,
    );
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { message: "Settings saved." };
}

export async function createStaffAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor();
  assertPermission(actor.membership.role, "manage_staff");
  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return invalidState(parsed.error);
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          businessId: actor.business.id,
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: "STAFF",
        },
      });
      await writeAuditLog(
        {
          businessId: actor.business.id,
          actorId: actor.user.id,
          action: "STAFF_CREATED",
          entityType: "User",
          entityId: user.id,
          description: "Staff account created.",
          afterData: { userId: user.id, role: user.role },
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        message:
          "A user with that email already exists. Staff invitations for existing accounts are not available yet.",
      };
    }
    console.error("Staff creation failed", error);
    return { message: "We could not add the staff member. Please try again." };
  }
  revalidatePath("/staff");
  return { message: "Staff member added. Share the temporary password securely." };
}
