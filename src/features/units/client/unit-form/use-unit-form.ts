"use client";

import { useQuery } from "@tanstack/react-query";

import { unitDetailOptions } from "../units.queries";
import type { UnitFormProps } from "./types";

/** Loads the unit for edit mode; create mode never fetches. */
export function useUnitForm(props: UnitFormProps) {
  const id = props.mode === "edit" ? props.id : "";
  return useQuery({ ...unitDetailOptions(id), enabled: props.mode === "edit" });
}
