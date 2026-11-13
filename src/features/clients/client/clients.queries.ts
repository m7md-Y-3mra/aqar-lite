import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/shared/lib/api-client";
import { clientKeys } from "../clients.keys";
import type { ClientDto, ClientListQuery, ClientPage } from "../clients.types";

export function clientListOptions(query: ClientListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  return queryOptions({
    queryKey: clientKeys.list(query),
    queryFn: () => apiFetch<ClientPage>(`/api/clients?${params.toString()}`),
  });
}

export function clientDetailOptions(id: string) {
  return queryOptions({
    queryKey: clientKeys.detail(id),
    queryFn: () => apiFetch<ClientDto>(`/api/clients/${id}`),
  });
}
