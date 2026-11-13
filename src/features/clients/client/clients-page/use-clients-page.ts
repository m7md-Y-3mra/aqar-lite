"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { toQueryInput } from "@/shared/lib/search-params";
import { clientListQuerySchema } from "../../clients.schemas";
import type { ClientListQuery } from "../../clients.types";
import { clientListOptions } from "../clients.queries";

export function useClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = clientListQuerySchema.safeParse(toQueryInput(searchParams));
  const query = parsed.success ? parsed.data : clientListQuerySchema.parse({});
  const result = useQuery({
    ...clientListOptions(query),
    placeholderData: keepPreviousData,
    enabled: parsed.success,
  });

  function navigate(next: ClientListQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      if (key === "page" && value === 1) continue;
      if (key === "pageSize" && value === 20) continue;
      params.set(key, String(value));
    }
    const search = params.toString();
    router.push(search ? `/clients?${search}` : "/clients");
  }

  return {
    query,
    valid: parsed.success,
    result,
    setPage: (page: number) => navigate({ ...query, page }),
  };
}
