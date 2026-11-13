import type { ContractStatus, InstallmentStatus } from "../contracts.types";

export const ESTIMATED_DATES_LABEL = "التواريخ تقديرية، وتُثبَّت عند الاعتماد";
export const contractStatusLabels: Record<ContractStatus, string> = {
  DRAFT: "مسودة",
  APPROVED: "معتمد",
};
export const installmentStatusLabels: Record<InstallmentStatus, string> = {
  UNPAID: "غير مدفوع",
  PARTIAL: "مدفوع جزئياً",
  PAID: "مدفوع",
  OVERDUE: "متأخر",
};
