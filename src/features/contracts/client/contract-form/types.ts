import type { ContractDetailDto } from "../../contracts.types";

type RelatedQueries = { relatedQueryKeys: readonly (readonly unknown[])[] };
export type ContractFormProps = RelatedQueries & (
  | { mode: "create"; reservationId: string; unitPrice: number; today: string }
  | { mode: "edit"; contract: ContractDetailDto }
);
