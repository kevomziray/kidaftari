import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  businessId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  input: AuditInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.auditLog.create({
    data: {
      businessId: input.businessId,
      userId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description ?? null,
      beforeData: input.beforeData,
      afterData: input.afterData,
      metadata: input.metadata,
    },
  });
}
