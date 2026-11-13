import type { AuditLogListQuery } from "./audit-log.types";

export const auditLogKeys = {
  all: ["audit-log"] as const,
  list: (query: AuditLogListQuery) => [...auditLogKeys.all, "list", query] as const,
};
