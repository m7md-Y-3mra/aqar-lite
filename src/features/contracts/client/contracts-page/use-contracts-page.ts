"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { toQueryInput } from "@/shared/lib/search-params";
import { contractListQuerySchema } from "../../contracts.schemas";
import type { ContractListQuery } from "../../contracts.types";
import { contractListOptions } from "../contracts.queries";

export function useContractsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = contractListQuerySchema.safeParse(toQueryInput(searchParams));
  const query = parsed.success ? parsed.data : contractListQuerySchema.parse({});
  const result = useQuery({
    ...contractListOptions(query),
    placeholderData: keepPreviousData,
    enabled: parsed.success,
  });

  function navigate(next: ContractListQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      if (key === "page" && value === 1) continue;
      if (key === "pageSize" && value === 20) continue;
      params.set(key, String(value));
    }
    const search = params.toString();
    router.push(search ? `/contracts?${search}` : "/contracts");
  }

  return {
    query,
    valid: parsed.success,
    result,
    setPage: (page: number) => navigate({ ...query, page }),
  };
}
