import "server-only";

import { getDb, type Tx } from "@/server/db";
import { toSkip } from "@/shared/lib/pagination";
import type { AuditLogListQuery } from "../audit-log.types";

export function findAuditLogs(companyId: string, query: AuditLogListQuery, tx?: Tx) {
  const db = tx ?? getDb();
  return db.auditLog.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: toSkip(query.page, query.pageSize),
    take: query.pageSize,
    select: {
      id: true,
      action: true,
      entityId: true,
      meta: true,
      createdAt: true,
      user: { select: { name: true, companyId: true } },
    },
  });
}

export function countAuditLogs(companyId: string, tx?: Tx) {
  const db = tx ?? getDb();
  return db.auditLog.count({ where: { companyId } });
}
