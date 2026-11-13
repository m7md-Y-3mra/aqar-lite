import type { ReactNode } from "react";

import type { Role } from "@/shared/lib/roles";

export type ContractDetailsProps = {
  id: string;
  role: Role;
  userId: string;
  relatedQueryKeys: readonly (readonly unknown[])[];
  /** Shown under the schedule of an approved contract (the payments feature, composed by the page). */
  paymentsSlot?: ReactNode;
};
