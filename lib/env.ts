import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters."),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must contain at least 32 characters.").optional(),
  APP_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:3000")
    .transform((value) => value.split(",").map((origin) => origin.trim().replace(/\/$/, "")))
    .refine((origins) => origins.every((origin) => z.string().url().safeParse(origin).success), {
      message: "APP_ORIGIN must contain one or more valid comma-separated URLs.",
    }),
  SMS_PROVIDER: z.enum(["console", "webhook"]).default("console"),
  SMS_SENDER_ID: z.string().max(32).optional(),
  SMS_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  SMS_WEBHOOK_TOKEN: z.string().optional(),
});

/**
 * Validate server-only configuration at a deliberate application boundary.
 * Do not import this from client components or expose its values with NEXT_PUBLIC_.
 */
export function getServerEnv() {
  return environmentSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    APP_ORIGIN: process.env.APP_ORIGIN,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    SMS_SENDER_ID: process.env.SMS_SENDER_ID,
    SMS_WEBHOOK_URL: process.env.SMS_WEBHOOK_URL,
    SMS_WEBHOOK_TOKEN: process.env.SMS_WEBHOOK_TOKEN,
  });
}
