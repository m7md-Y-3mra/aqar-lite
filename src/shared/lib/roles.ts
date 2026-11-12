export const ROLES = ["MANAGER", "SALES", "ACCOUNTANT"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MANAGER: "مدير",
  SALES: "مندوب مبيعات",
  ACCOUNTANT: "محاسب",
};
