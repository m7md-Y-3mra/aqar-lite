import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

function checkEnv(env: Record<string, string>) {
  return spawnSync(process.execPath, ["--conditions=react-server", "scripts/check-env.ts"], {
    cwd: ROOT,
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
    encoding: "utf8",
  });
}

describe("scripts/check-env.ts", () => {
  it("exits 0 when the environment is valid", () => {
    const run = checkEnv({
      DATABASE_URL: "postgresql://aqar:aqar@localhost:5433/aqar",
      APP_ORIGIN: "http://localhost:3000",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Environment OK");
  });

  it("exits 1 and names a missing variable", () => {
    const run = checkEnv({ DATABASE_URL: "postgresql://aqar:aqar@localhost:5433/aqar" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("APP_ORIGIN");
  });

  it("names every failing variable without printing secrets", () => {
    const run = checkEnv({ DATABASE_URL: "", LOG_LEVEL: "loud", SESSION_HINT: "TopSecret99" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("DATABASE_URL");
    expect(run.stderr).toContain("APP_ORIGIN");
    expect(run.stderr).toContain("LOG_LEVEL");
    expect(run.stderr).not.toContain("TopSecret99");
    expect(run.stderr).not.toContain("loud");
  });
});
