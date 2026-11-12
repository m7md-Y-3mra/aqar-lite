"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { toQueryInput } from "@/shared/lib/search-params";
import { unitListQuerySchema } from "../../units.schemas";
import type { UnitListQuery } from "../../units.types";
import { unitListOptions } from "../units.queries";

export function useUnitsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = unitListQuerySchema.safeParse(toQueryInput(searchParams));
  const query = parsed.success ? parsed.data : unitListQuerySchema.parse({});
  const result = useQuery({
    ...unitListOptions(query),
    placeholderData: keepPreviousData,
    enabled: parsed.success,
  });

  function navigate(next: UnitListQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      if (key === "page" && value === 1) continue;
      if (key === "pageSize" && value === 20) continue;
      if (key === "order" && value === "asc") continue;
      params.set(key, String(value));
    }
    const search = params.toString();
    router.push(search ? `/units?${search}` : "/units");
  }

  return {
    query,
    valid: parsed.success,
    result,
    hasFilters:
      query.status !== undefined || query.minPrice !== undefined || query.maxPrice !== undefined,
    setFilters: (next: Partial<UnitListQuery>) => navigate({ ...query, ...next, page: 1 }),
    setPage: (page: number) => navigate({ ...query, page }),
  };
}
