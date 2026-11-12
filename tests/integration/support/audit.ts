import { getDb } from "@/server/db";

type LoginFailure = {
  id: string;
  companyId: string | null;
  userId: string | null;
  action: "LOGIN_FAILED";
  entityId: string | null;
  meta: { email: string; reason: "invalid_credentials" | "locked" };
  createdAt: Date;
};

export function loginFailures(email: string): Promise<LoginFailure[]> {
  return getDb().$queryRaw<LoginFailure[]>`
    SELECT
      id,
      company_id AS "companyId",
      user_id AS "userId",
      action,
      entity_id AS "entityId",
      meta,
      created_at AS "createdAt"
    FROM audit_logs
    WHERE action = 'LOGIN_FAILED' AND meta->>'email' = ${email}
    ORDER BY created_at
  `;
}
