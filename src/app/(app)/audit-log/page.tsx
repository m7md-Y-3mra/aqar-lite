import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { auditLogKeys } from "@/features/audit-log/audit-log.keys";
import { auditLogListQuerySchema } from "@/features/audit-log/audit-log.schemas";
import { AuditLogPage } from "@/features/audit-log/client/audit-log-page";
import { listAuditLog } from "@/features/audit-log/server";
import { requireUser } from "@/server/auth/require-user";
import { getQueryClient } from "@/shared/lib/query-client";
import { toQueryInput } from "@/shared/lib/search-params";

type AuditLogRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditLogRoute({ searchParams }: AuditLogRouteProps) {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect("/");

  const parsed = auditLogListQuerySchema.safeParse(toQueryInput(await searchParams));
  const queryClient = getQueryClient();

  if (parsed.success) {
    // This query client is request-scoped; keep the client key for hydration.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    await queryClient.prefetchQuery({
      queryKey: auditLogKeys.list(parsed.data),
      queryFn: () => listAuditLog(user, parsed.data),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AuditLogPage />
    </HydrationBoundary>
  );
}
