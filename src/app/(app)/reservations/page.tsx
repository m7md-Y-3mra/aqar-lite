import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { ReservationsPage } from "@/features/reservations/client/reservations-page";
import { reservationKeys } from "@/features/reservations/reservations.keys";
import { reservationListQuerySchema } from "@/features/reservations/reservations.schemas";
import { listActiveReservations } from "@/features/reservations/server";
import { requireUser } from "@/server/auth/require-user";
import { getQueryClient } from "@/shared/lib/query-client";
import { toQueryInput } from "@/shared/lib/search-params";

type ReservationsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReservationsRoute({ searchParams }: ReservationsRouteProps) {
  const user = await requireUser();
  if (user.role === "ACCOUNTANT") redirect("/");

  const parsed = reservationListQuerySchema.safeParse(toQueryInput(await searchParams));
  const queryClient = getQueryClient();

  if (parsed.success) {
    // This query client is request-scoped; keep the client key for hydration.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    await queryClient.prefetchQuery({
      queryKey: reservationKeys.list(parsed.data),
      queryFn: () => listActiveReservations(user, parsed.data),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReservationsPage role={user.role} />
    </HydrationBoundary>
  );
}
