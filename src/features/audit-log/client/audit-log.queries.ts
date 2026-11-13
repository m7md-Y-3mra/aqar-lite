import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/shared/lib/api-client";
import { auditLogKeys } from "../audit-log.keys";
import type { AuditLogListQuery, AuditLogPage } from "../audit-log.types";

export function auditLogListOptions(query: AuditLogListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  return queryOptions({
    queryKey: auditLogKeys.list(query),
    queryFn: () => apiFetch<AuditLogPage>(`/api/audit-log?${params.toString()}`),
  });
}
