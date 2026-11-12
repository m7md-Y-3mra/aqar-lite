import type { ClientListQuery } from "./clients.types";

export const clientKeys = {
  all: ["clients"] as const,
  list: (query: ClientListQuery) => [...clientKeys.all, "list", query] as const,
  detail: (id: string) => [...clientKeys.all, "detail", id] as const,
};
