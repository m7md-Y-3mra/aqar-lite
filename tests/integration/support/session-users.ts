import type { User } from "@/generated/prisma/client";
import type { SessionUser } from "@/server/auth/session.service";
import { makeCompany, makeUser } from "./db-fixtures";

export async function makeSessionUser(
  companyId: string,
  role: User["role"],
  companyName = "شركة اختبار",
): Promise<SessionUser> {
  const user = await makeUser(companyId, role);
  return {
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    name: user.name,
    companyName,
  };
}

async function makeCompanyUsers() {
  const company = await makeCompany();
  const [manager, accountant, sales1, sales2] = await Promise.all([
    makeSessionUser(company.id, "MANAGER", company.name),
    makeSessionUser(company.id, "ACCOUNTANT", company.name),
    makeSessionUser(company.id, "SALES", company.name),
    makeSessionUser(company.id, "SALES", company.name),
  ]);
  return { companyId: company.id, manager, accountant, sales1, sales2 };
}

/** Company A and company B, each with a manager, an accountant and two sales reps. */
export async function makeTwoCompanies() {
  const [a, b] = await Promise.all([makeCompanyUsers(), makeCompanyUsers()]);
  return { a, b };
}
