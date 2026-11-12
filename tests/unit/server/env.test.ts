import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EnvError, envSchema, parseEnv } from "@/server/env";

const VALID = {
  DATABASE_URL: "postgresql://aqar:aqar@localhost:5433/aqar",
  APP_ORIGIN: "http://localhost:3000",
};

function errorOf(source: Record<string, string | undefined>) {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error.message;
    throw error;
  }
  throw new Error("expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("returns typed values and defaults LOG_LEVEL to info", () => {
    expect(parseEnv(VALID)).toEqual({
      ...VALID,
      APP_ORIGIN: ["http://localhost:3000"],
      LOG_LEVEL: "info",
    });
  });

  it("splits APP_ORIGIN into trimmed origins", () => {
    expect(
      parseEnv({ ...VALID, APP_ORIGIN: "http://localhost:3000, http://127.0.0.1:3000" }).APP_ORIGIN,
    ).toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
  });

  it.each(["http://localhost:3000,http://x.com/path", "http://localhost:3000,", "*"])(
    "rejects an APP_ORIGIN list with an invalid entry: %s",
    (value) => {
      expect(errorOf({ ...VALID, APP_ORIGIN: value })).toContain("APP_ORIGIN: must be");
    },
  );

  it("names a missing DATABASE_URL", () => {
    expect(errorOf({ ...VALID, DATABASE_URL: undefined })).toContain("DATABASE_URL: missing");
  });

  it("treats a whitespace-only value as missing", () => {
    expect(errorOf({ ...VALID, APP_ORIGIN: "   " })).toContain("APP_ORIGIN: missing");
  });

  it("rejects an APP_ORIGIN with a path", () => {
    expect(errorOf({ ...VALID, APP_ORIGIN: "http://x.com/path" })).toContain(
      "APP_ORIGIN: must be a comma-separated list of origins",
    );
  });

  it("rejects a non-Postgres DATABASE_URL", () => {
    expect(errorOf({ ...VALID, DATABASE_URL: "mysql://u:p@h/db" })).toContain("DATABASE_URL");
  });

  it("lists every failing variable once", () => {
    const message = errorOf({});
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("APP_ORIGIN");
    expect(message.match(/APP_ORIGIN/g)).toHaveLength(1);
  });

  it("never prints a secret value", () => {
    const message = errorOf({ DATABASE_URL: "postgresql://u:SuperSecret123@h/db" });
    expect(message).toContain("APP_ORIGIN");
    expect(message).not.toContain("SuperSecret123");
  });

  it("matches the app variables listed in .env.example", () => {
    const example = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
    const appPart = example.split("# Tooling only")[0] ?? "";
    const keys = [...appPart.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual(Object.keys(envSchema.shape).sort());
  });
});
