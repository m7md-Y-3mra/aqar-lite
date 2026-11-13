import type { ContractTermsInput } from "../../../../contracts.types";

export type ApproveContractButtonProps = {
  id: string;
  canApprove: boolean;
  terms: ContractTermsInput;
  relatedQueryKeys: readonly (readonly unknown[])[];
};
