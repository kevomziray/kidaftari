import { z } from "zod";
import { normalizeTanzanianPhone } from "@/lib/security";

export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .transform((value, ctx) => {
    try {
      return normalizeTanzanianPhone(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter a Tanzanian mobile number, e.g. 0712 345 678.",
      });
      return z.NEVER;
    }
  });

export const identifierSchema = z
  .string()
  .trim()
  .min(1, "Enter your phone or email.")
  .max(320)
  .transform((value, ctx) => {
    if (value.includes("@")) {
      const email = z.email().safeParse(value.toLowerCase());
      if (email.success) return { email: email.data, phone: null };
    } else {
      const phone = phoneSchema.safeParse(value);
      if (phone.success) return { email: null, phone: phone.data };
    }
    ctx.addIssue({ code: "custom", message: "Enter a valid email or Tanzanian mobile number." });
    return z.NEVER;
  });

// bcrypt processes at most 72 UTF-8 bytes; never silently truncate a password.
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72)
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Use at most 72 bytes (fewer for emoji or accented characters).",
  );

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Your full name is required.").max(160),
  identifier: identifierSchema,
  password: passwordSchema,
  businessName: z.string().trim().min(1, "Business name is required.").max(160),
  businessPhone: phoneSchema,
});

export const signInSchema = z.object({
  identifier: identifierSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(72)
    .refine((value) => new TextEncoder().encode(value).length <= 72, "Password is too long."),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, "Full name is required.").max(160),
  identifier: identifierSchema,
  password: passwordSchema,
  role: z.literal("STAFF"),
});

export const onboardingSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("1"),
    businessName: z.string().trim().min(1, "Business name is required.").max(160),
  }),
  z.object({ step: z.literal("2"), businessPhone: phoneSchema }),
  z.object({
    step: z.literal("3"),
    address: z.string().trim().min(1, "Business location is required.").max(1000),
  }),
  z.object({ step: z.literal("4"), language: z.enum(["EN", "SW"]) }),
  z.object({ step: z.literal("5"), remindersEnabled: z.enum(["true", "false"]) }),
]);
