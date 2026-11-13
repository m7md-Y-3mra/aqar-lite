import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";

import { UnitForm } from "@/features/units/client/unit-form";
import { getUnit } from "@/features/units/server";
import { unitKeys } from "@/features/units/units.keys";
import { unitIdSchema } from "@/features/units/units.schemas";
import { requireUser } from "@/server/auth/require-user";
import { AppError } from "@/server/http/app-error";
import { getQueryClient } from "@/shared/lib/query-client";

type EditUnitRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUnitRoute({ params }: EditUnitRouteProps) {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect("/units");

  const parsed = unitIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const id = parsed.data;

  const queryClient = getQueryClient();
  // This query client is request-scoped; keep the client key for hydration.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  await queryClient.prefetchQuery({
    queryKey: unitKeys.detail(id),
    queryFn: () => getUnit(user, id),
  });
  const error = queryClient.getQueryState(unitKeys.detail(id))?.error;
  if (error instanceof AppError && error.code === "NOT_FOUND") notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UnitForm mode="edit" id={id} />
    </HydrationBoundary>
  );
}
