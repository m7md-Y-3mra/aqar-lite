import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/shared/lib/api-client";
import { contractKeys } from "../contracts.keys";
import type {
  ContractDetailDto, ContractListQuery, ContractOptionsDto, ContractPage,
  ContractTermsInput, CreateContractInput,
} from "../contracts.types";

export function contractListOptions(query: ContractListQuery) {
  return queryOptions({
    queryKey: contractKeys.list(query),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
      return apiFetch<ContractPage>(`/api/contracts?${params}`);
    },
  });
}

export function contractDetailOptions(id: string) {
  return queryOptions({
    queryKey: contractKeys.detail(id),
    queryFn: () => apiFetch<ContractDetailDto>(`/api/contracts/${id}`),
  });
}

export function contractOptionsOptions(reservationId: string) {
  return queryOptions({
    queryKey: contractKeys.options(reservationId),
    queryFn: () => apiFetch<ContractOptionsDto>(`/api/contracts/options?${new URLSearchParams({ reservationId })}`),
  });
}

export function createContract(input: CreateContractInput) {
  return apiFetch<ContractDetailDto>("/api/contracts", { method: "POST", body: JSON.stringify(input) });
}

export function updateContract(id: string, input: ContractTermsInput) {
  return apiFetch<ContractDetailDto>(`/api/contracts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function approveContract(id: string, input: ContractTermsInput) {
  return apiFetch<ContractDetailDto>(`/api/contracts/${id}/approve`, { method: "POST", body: JSON.stringify(input) });
}
