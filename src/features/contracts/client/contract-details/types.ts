import type { Role } from "@/shared/lib/roles";

export type ContractDetailsProps = {
  id: string;
  role: Role;
  userId: string;
  relatedQueryKeys: readonly (readonly unknown[])[];
};
