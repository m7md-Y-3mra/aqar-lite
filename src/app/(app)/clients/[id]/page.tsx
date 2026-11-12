import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { ClientDetails } from "@/features/clients/client/client-details";
import { getClient } from "@/features/clients/server";
import { clientKeys } from "@/features/clients/clients.keys";
import { clientIdSchema } from "@/features/clients/clients.schemas";
import { requireUser } from "@/server/auth/require-user";
import { AppError } from "@/server/http/app-error";
import { getQueryClient } from "@/shared/lib/query-client";

type ClientDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailRoute({ params }: ClientDetailRouteProps) {
  const user = await requireUser();

  const parsed = clientIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const id = parsed.data;

  const queryClient = getQueryClient();
  // This query client is request-scoped; keep the client key for hydration.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  await queryClient.prefetchQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => getClient(user, id),
  });
  const error = queryClient.getQueryState(clientKeys.detail(id))?.error;
  if (error instanceof AppError && error.code === "NOT_FOUND") notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientDetails id={id} role={user.role} />
    </HydrationBoundary>
  );
}
