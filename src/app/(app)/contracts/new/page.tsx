import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";

import { NewContractPage } from "@/features/contracts/client/new-contract-page";
import { contractKeys } from "@/features/contracts/contracts.keys";
import { contractOptionsQuerySchema } from "@/features/contracts/contracts.schemas";
import { getContractOptions } from "@/features/contracts/server";
import { reservationKeys } from "@/features/reservations/reservations.keys";
import { unitKeys } from "@/features/units/units.keys";
import { requireUser } from "@/server/auth/require-user";
import { AppError } from "@/server/http/app-error";
import { getQueryClient } from "@/shared/lib/query-client";
import { toQueryInput } from "@/shared/lib/search-params";

type NewContractRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewContractRoute({ searchParams }: NewContractRouteProps) {
  const user = await requireUser();
  if (user.role !== "SALES") redirect("/contracts");
  const parsed = contractOptionsQuerySchema.safeParse(toQueryInput(await searchParams));
  if (!parsed.success) notFound();
  const { reservationId } = parsed.data;
  const queryClient = getQueryClient();
  // This query client is request-scoped; keep the client key for hydration.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  await queryClient.prefetchQuery({
    queryKey: contractKeys.options(reservationId),
    queryFn: () => getContractOptions(user, reservationId),
  });
  const error = queryClient.getQueryState(contractKeys.options(reservationId))?.error;
  if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewContractPage reservationId={reservationId} relatedQueryKeys={[unitKeys.all, reservationKeys.all]} />
    </HydrationBoundary>
  );
}
