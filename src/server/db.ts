import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { getEnv } from "./env";

const globalDb = globalThis as typeof globalThis & { aqarDb?: PrismaClient };
let db: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!db) {
    db =
      globalDb.aqarDb ??
      new PrismaClient({
        adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }),
      });
    if (process.env.NODE_ENV !== "production") globalDb.aqarDb = db;
  }
  return db;
}

export type Tx = Prisma.TransactionClient;

export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().$transaction(fn);
}
