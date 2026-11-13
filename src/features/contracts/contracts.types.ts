import type { z } from "zod";

import type { Page } from "@/shared/lib/pagination";
import type {
  contractListQuerySchema,
  contractTermsInputSchema,
  createContractInputSchema,
} from "./contracts.schemas";
import type { InstallmentStatus } from "./domain/installment-status";
import type { ScheduleLine } from "./domain/schedule";

export type { InstallmentStatus } from "./domain/installment-status";
export type ContractStatus = "DRAFT" | "APPROVED";
export type ContractTermsInput = z.infer<typeof contractTermsInputSchema>;
export type CreateContractInput = z.infer<typeof createContractInputSchema>;
export type ContractListQuery = z.infer<typeof contractListQuerySchema>;
export type ContractListItemDto = {
  id: string;
  status: ContractStatus;
  reservationExpired: boolean;
  unit: { id: string; projectName: string; number: string };
  client: { id: string; name: string };
  salesRep: { id: string; name: string };
  finalPrice: number;
  remaining: number;
  approvedAt: string | null;
};
export type ScheduleLineDto =
  ScheduleLine | (ScheduleLine & { paidAmount: number; status: InstallmentStatus });
export type ContractDetailDto = ContractListItemDto & {
  unit: ContractListItemDto["unit"] & { price: number };
  reservation: { id: string; expiresAt: string };
  downPayment: number;
  installmentCount: number;
  minFinalPrice: number;
  startDate: string | null;
  today: string;
  schedule: { estimated: boolean; lines: ScheduleLineDto[] };
};
export type ContractOptionsDto = {
  reservation: { id: string; expiresAt: string };
  unit: { id: string; projectName: string; number: string; price: number };
  client: { id: string; name: string };
  minFinalPrice: number;
  today: string;
  contractId: string | null;
};
export type ContractPage = Page<ContractListItemDto>;
