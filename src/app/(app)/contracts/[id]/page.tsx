import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { ContractDetails } from "@/features/contracts/client/contract-details";
import { getContract } from "@/features/contracts/server";
import { contractKeys } from "@/features/contracts/contracts.keys";
import { contractIdSchema } from "@/features/contracts/contracts.schemas";
import { reservationKeys } from "@/features/reservations/reservations.keys";
import { unitKeys } from "@/features/units/units.keys";
import { requireUser } from "@/server/auth/require-user";
import { AppError } from "@/server/http/app-error";
import { getQueryClient } from "@/shared/lib/query-client";

type ContractDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ContractDetailRoute({ params }: ContractDetailRouteProps) {
  const user = await requireUser();

  const parsed = contractIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const id = parsed.data;

  const queryClient = getQueryClient();
  // This query client is request-scoped; keep the client key for hydration.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  await queryClient.prefetchQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => getContract(user, id),
  });
  const error = queryClient.getQueryState(contractKeys.detail(id))?.error;
  if (error instanceof AppError && error.code === "NOT_FOUND") notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContractDetails id={id} role={user.role} userId={user.userId} relatedQueryKeys={[unitKeys.all, reservationKeys.all]} />
    </HydrationBoundary>
  );
}
