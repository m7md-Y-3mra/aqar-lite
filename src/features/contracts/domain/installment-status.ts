export type InstallmentStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

export function installmentStatus(
  line: { amount: number; paidAmount: number; dueDate: string },
  today: string,
): InstallmentStatus {
  if (line.paidAmount === line.amount) return "PAID";
  if (line.dueDate < today) return "OVERDUE";
  if (line.paidAmount > 0) return "PARTIAL";
  return "UNPAID";
}

export function contractRemaining(
  finalPrice: number,
  lines: readonly { paidAmount: number }[],
): number {
  return finalPrice - lines.reduce((total, line) => total + line.paidAmount, 0);
}
