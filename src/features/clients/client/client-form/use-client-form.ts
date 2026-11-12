"use client";

import { useQuery } from "@tanstack/react-query";

import { clientDetailOptions } from "../clients.queries";
import type { ClientFormProps } from "./types";

/** Loads the client for edit mode; create mode never fetches. */
export function useClientForm(props: ClientFormProps) {
  const id = props.mode === "edit" ? props.id : "";
  return useQuery({ ...clientDetailOptions(id), enabled: props.mode === "edit" });
}
