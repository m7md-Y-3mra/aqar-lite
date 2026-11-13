import "server-only";

import type { SessionUser } from "@/server/auth/session.service";
import { AppError } from "@/server/http/app-error";
import type { AuditLogListQuery, AuditLogPage } from "../audit-log.types";
import { toAuditEvent } from "../domain/audit-event";
import { countAuditLogs, findAuditLogs } from "./audit-log.repository";

export async function listAuditLog(
  user: SessionUser,
  query: AuditLogListQuery,
): Promise<AuditLogPage> {
  if (user.role !== "MANAGER") throw new AppError("FORBIDDEN");
  const [rows, total] = await Promise.all([
    findAuditLogs(user.companyId, query),
    countAuditLogs(user.companyId),
  ]);
  return {
    items: rows.map((row) =>
      toAuditEvent({
        id: row.id,
        action: row.action,
        entityId: row.entityId,
        meta: row.meta,
        createdAt: row.createdAt,
        actorName: row.user?.companyId === user.companyId ? row.user.name : null,
      }),
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
