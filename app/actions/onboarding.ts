"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { assertSameOrigin } from "@/lib/csrf";
import { requireActor } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { onboardingSchema } from "@/lib/auth-validation";
import { invalidState, type ActionState } from "@/lib/validation";

export async function saveOnboardingStepAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertSameOrigin();
  const actor = await requireActor({ allowIncomplete: true });
  if (actor.user.role !== "OWNER")
    return { message: "Only the business owner can complete setup." };
  if (actor.business.onboardingCompletedAt) redirect("/dashboard");
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error);
  const step = Number(parsed.data.step);
  if (step > actor.business.onboardingStep)
    return { message: "Please complete the earlier steps first." };
  const data: Prisma.BusinessUpdateManyMutationInput = {};
  switch (parsed.data.step) {
    case "1":
      data.businessName = parsed.data.businessName;
      break;
    case "2":
      data.businessPhone = parsed.data.businessPhone;
      break;
    case "3":
      data.address = parsed.data.address;
      break;
    case "4":
      data.language = parsed.data.language;
      break;
    case "5":
      data.remindersEnabled = parsed.data.remindersEnabled === "true";
      data.onboardingCompletedAt = new Date();
      break;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.business.updateMany({
        where: {
          id: actor.business.id,
          active: true,
          onboardingCompletedAt: null,
          onboardingStep: actor.business.onboardingStep,
        },
        data: {
          ...data,
          onboardingStep: Math.max(actor.business.onboardingStep, Math.min(step + 1, 5)),
        },
      });
      if (!updated.count) throw new Error("Setup changed in another tab.");
      if (step === 5)
        await writeAuditLog(
          {
            businessId: actor.business.id,
            actorId: actor.user.id,
            action: "ONBOARDING_COMPLETED",
            entityType: "Business",
            entityId: actor.business.id,
            description: "Business setup completed.",
          },
          tx,
        );
    });
  } catch {
    return { message: "We could not save this step. Refresh the page and try again." };
  }
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect(step === 5 ? "/dashboard" : `/onboarding?step=${step + 1}`);
}
