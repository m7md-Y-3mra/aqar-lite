import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/shared/lib/api-client";
import { reservationKeys } from "../reservations.keys";
import type { ReservationDto, ReserveInput, ReserveOptionsDto } from "../reservations.types";

export function reserveOptionsOptions(unitId: string) {
  return queryOptions({
    queryKey: reservationKeys.options(unitId),
    queryFn: () =>
      apiFetch<ReserveOptionsDto>(`/api/reservations/options?${new URLSearchParams({ unitId })}`),
    staleTime: 0,
  });
}

export function reserveUnit(input: ReserveInput) {
  return apiFetch<ReservationDto>("/api/reservations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
