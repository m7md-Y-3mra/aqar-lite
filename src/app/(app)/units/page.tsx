import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ReserveUnitDialog } from "@/features/reservations/client/reserve-unit-dialog";
import { UnitsPage } from "@/features/units/client/units-page";
import { listUnits } from "@/features/units/server";
import { unitKeys } from "@/features/units/units.keys";
import { unitListQuerySchema } from "@/features/units/units.schemas";
import { requireUser } from "@/server/auth/require-user";
import { getQueryClient } from "@/shared/lib/query-client";
import { toQueryInput } from "@/shared/lib/search-params";

type UnitsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnitsRoute({ searchParams }: UnitsRouteProps) {
  const user = await requireUser();
  const parsed = unitListQuerySchema.safeParse(toQueryInput(await searchParams));
  const queryClient = getQueryClient();

  if (parsed.success) {
    // This query client is request-scoped; keep the client key for hydration.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    await queryClient.prefetchQuery({
      queryKey: unitKeys.list(parsed.data),
      queryFn: () => listUnits(user, parsed.data),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UnitsPage
        role={user.role}
        reserveDialog={
          user.role === "SALES" ? <ReserveUnitDialog unitsQueryKey={unitKeys.all} /> : null
        }
      />
    </HydrationBoundary>
  );
}
