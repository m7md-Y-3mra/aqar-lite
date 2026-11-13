"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { toQueryInput } from "@/shared/lib/search-params";
import { auditLogListQuerySchema } from "../../audit-log.schemas";
import { auditLogListOptions } from "../audit-log.queries";

export function useAuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = auditLogListQuerySchema.safeParse(toQueryInput(searchParams));
  const query = parsed.success ? parsed.data : auditLogListQuerySchema.parse({});
  const result = useQuery({
    ...auditLogListOptions(query),
    placeholderData: keepPreviousData,
    enabled: parsed.success,
  });

  function setPage(page: number) {
    const params = new URLSearchParams();
    if (page !== 1) params.set("page", String(page));
    if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
    const search = params.toString();
    router.push(search ? `/audit-log?${search}` : "/audit-log");
  }

  return { query, valid: parsed.success, result, setPage };
}
