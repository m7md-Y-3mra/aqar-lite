"use client";

import { useQuery } from "@tanstack/react-query";

import { contractDetailOptions } from "../contracts.queries";

export function useEditContractPage(id: string) {
  return useQuery(contractDetailOptions(id));
}
