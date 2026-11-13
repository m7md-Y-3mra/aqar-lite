import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";

import { EditContractPage } from "@/features/contracts/client/edit-contract-page";
import { contractKeys } from "@/features/contracts/contracts.keys";
import { contractIdSchema } from "@/features/contracts/contracts.schemas";
import { getContract } from "@/features/contracts/server";
import { reservationKeys } from "@/features/reservations/reservations.keys";
import { requireUser } from "@/server/auth/require-user";
import { AppError } from "@/server/http/app-error";
import { getQueryClient } from "@/shared/lib/query-client";

type EditContractRouteProps = { params: Promise<{ id: string }> };

export default async function EditContractRoute({ params }: EditContractRouteProps) {
  const user = await requireUser();
  const parsed = contractIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const id = parsed.data;
  if (user.role !== "SALES") redirect(`/contracts/${id}`);
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
      <EditContractPage id={id} userId={user.userId} relatedQueryKeys={[reservationKeys.all]} />
    </HydrationBoundary>
  );
}
