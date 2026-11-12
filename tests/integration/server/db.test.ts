import { afterAll, describe, expect, it } from "vitest";

import { getDb, withTransaction } from "@/server/db";

afterAll(async () => {
  await getDb().$disconnect();
});

describe("db", () => {
  it("runs a real query on the test database", async () => {
    const rows = await withTransaction(
      (tx) => tx.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`,
    );
    expect(rows[0]?.db).toBe("aqar_test");
  });

  it("rejects the transaction when the callback throws", async () => {
    await expect(
      withTransaction(async (tx) => {
        await tx.$queryRaw`SELECT 1`;
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
  });
});
