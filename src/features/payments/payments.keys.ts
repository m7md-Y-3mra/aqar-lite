export const paymentKeys = {
  all: ["payments"] as const,
  list: (contractId: string) => [...paymentKeys.all, "list", contractId] as const,
};
