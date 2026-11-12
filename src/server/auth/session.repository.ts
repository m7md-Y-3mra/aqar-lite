import "server-only";

import { getDb, type Tx } from "@/server/db";

type DbClient = ReturnType<typeof getDb> | Tx;

type CreateSessionInput = {
  id: string;
  userId: string;
  expiresAt: Date;
};

// These functions take no companyId because the session establishes the tenant.
export function createSession(input: CreateSessionInput, tx: DbClient = getDb()) {
  return tx.session.create({ data: input });
}

export function findSessionWithUser(id: string, tx: DbClient = getDb()) {
  return tx.session.findUnique({
    where: { id },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          companyId: true,
          company: { select: { name: true } },
        },
      },
    },
  });
}

export function deleteSession(id: string, tx: DbClient = getDb()) {
  return tx.session.deleteMany({ where: { id } });
}
