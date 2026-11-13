"use client";

import { useQuery } from "@tanstack/react-query";

import { clientDetailOptions } from "../clients.queries";

export function useClientDetails(id: string) {
  return useQuery(clientDetailOptions(id));
}
