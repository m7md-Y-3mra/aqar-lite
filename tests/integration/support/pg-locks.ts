import { getDb } from "@/server/db";

export async function waitForLockWait(queryLike: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  do {
    const [row] = await getDb().$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query ILIKE ${queryLike}
    `;
    if ((row?.count ?? 0n) > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  throw new Error(`Timed out after ${timeoutMs} ms waiting for a lock wait matching ${queryLike}`);
}
