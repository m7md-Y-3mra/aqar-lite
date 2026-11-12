import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";

type InsertAuditLogInput = {
  action: AuditAction;
  companyId: string | null;
  userId: string | null;
  entityId?: string | null;
  meta: Prisma.InputJsonObject;
  createdAt: Date;
};

export function insertAuditLog(input: InsertAuditLogInput, tx: Tx) {
  return tx.auditLog.create({ data: input });
}

// Keyed by email, no companyId (constitution 1.1.0 pre-login exception).
export async function countRecentLoginFailures(
  email: string,
  since: Date,
  tx: Tx,
): Promise<number> {
  const [row] = await tx.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) FROM audit_logs
    WHERE action = 'LOGIN_FAILED' AND meta->>'email' = ${email} AND meta->>'reason' = 'invalid_credentials' AND created_at > ${since}
  `;
  return Number(row!.count);
}
