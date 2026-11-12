import "server-only";

import { getDb, type Tx } from "@/server/db";

type DbClient = ReturnType<typeof getDb> | Tx;

// This lookup takes no companyId because login establishes the tenant (constitution I, pre-login exception).
export function findUserByEmail(email: string, tx: DbClient = getDb()) {
  return tx.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      role: true,
      companyId: true,
      passwordHash: true,
      company: { select: { name: true } },
    },
  });
}

export function lockLoginEmail(email: string, tx: Tx) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`;
}
