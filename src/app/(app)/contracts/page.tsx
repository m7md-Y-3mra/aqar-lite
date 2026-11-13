import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ContractsPage } from "@/features/contracts/client/contracts-page";
import { contractKeys } from "@/features/contracts/contracts.keys";
import { contractListQuerySchema } from "@/features/contracts/contracts.schemas";
import { listContracts } from "@/features/contracts/server";
import { requireUser } from "@/server/auth/require-user";
import { getQueryClient } from "@/shared/lib/query-client";
import { toQueryInput } from "@/shared/lib/search-params";

type ContractsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContractsRoute({ searchParams }: ContractsRouteProps) {
  const user = await requireUser();

  const parsed = contractListQuerySchema.safeParse(toQueryInput(await searchParams));
  const queryClient = getQueryClient();

  if (parsed.success) {
    // This query client is request-scoped; keep the client key for hydration.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    await queryClient.prefetchQuery({
      queryKey: contractKeys.list(parsed.data),
      queryFn: () => listContracts(user, parsed.data),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContractsPage />
    </HydrationBoundary>
  );
}
