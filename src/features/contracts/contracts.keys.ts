import type { ContractListQuery } from "./contracts.types";

export const contractKeys = {
  all: ["contracts"] as const,
  list: (query: ContractListQuery) => [...contractKeys.all, "list", query] as const,
  detail: (id: string) => [...contractKeys.all, "detail", id] as const,
  options: (reservationId: string) => [...contractKeys.all, "options", reservationId] as const,
};
