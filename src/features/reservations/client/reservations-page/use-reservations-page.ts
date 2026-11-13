"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { toQueryInput } from "@/shared/lib/search-params";
import { reservationListQuerySchema } from "../../reservations.schemas";
import { reservationListOptions } from "../reservations.queries";

export function useReservationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = reservationListQuerySchema.safeParse(toQueryInput(searchParams));
  const query = parsed.success ? parsed.data : reservationListQuerySchema.parse({});
  const result = useQuery({
    ...reservationListOptions(query),
    enabled: parsed.success,
  });

  function setPage(page: number) {
    const params = new URLSearchParams();
    if (page !== 1) params.set("page", String(page));
    if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
    const search = params.toString();
    router.push(search ? `/reservations?${search}` : "/reservations");
  }

  return { query, valid: parsed.success, result, setPage };
}
