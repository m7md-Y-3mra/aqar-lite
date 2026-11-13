import type { Role } from "@/shared/lib/roles";

export type ContractPaymentsProps = {
  contractId: string;
  role: Role;
  /** Queries of other features to refresh after a payment (the contract's schedule and lists). */
  relatedQueryKeys: readonly (readonly unknown[])[];
};
