import { execFileSync } from "node:child_process";
import pg from "pg";

const testDbUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://aqar:aqar@localhost:5433/aqar_test";

export default async function setup() {
  const url = new URL(testDbUrl);
  const dbName = url.pathname.slice(1);
  const where = `${url.hostname}:${url.port || "5432"}/${dbName}`;

  // A wrong URL must never migrate or wipe the app database.
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${dbName}": the database name must end in _test.`,
    );
  }

  const client = new pg.Client({ connectionString: testDbUrl, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
  } catch {
    throw new Error(
      `Test database not reachable at ${where}. Run \`docker compose up -d db\` first.`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testDbUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "inherit",
  });
}
