import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ClientsPage } from "@/features/clients/client/clients-page";
import { listClients } from "@/features/clients/server";
import { clientKeys } from "@/features/clients/clients.keys";
import { clientListQuerySchema } from "@/features/clients/clients.schemas";
import { requireUser } from "@/server/auth/require-user";
import { getQueryClient } from "@/shared/lib/query-client";
import { toQueryInput } from "@/shared/lib/search-params";

type ClientsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientsRoute({ searchParams }: ClientsRouteProps) {
  const user = await requireUser();
  const parsed = clientListQuerySchema.safeParse(toQueryInput(await searchParams));
  const queryClient = getQueryClient();

  if (parsed.success) {
    // This query client is request-scoped; keep the client key for hydration.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    await queryClient.prefetchQuery({
      queryKey: clientKeys.list(parsed.data),
      queryFn: () => listClients(user, parsed.data),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientsPage role={user.role} />
    </HydrationBoundary>
  );
}
