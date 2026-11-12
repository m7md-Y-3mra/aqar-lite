import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: fileURLToPath(new URL("../../..", import.meta.url)) });

async function restrictedImportErrors(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter(
    (m) =>
      m.ruleId === "no-restricted-imports" ||
      m.ruleId === "@typescript-eslint/no-restricted-imports",
  );
}

const SERVICE = "src/features/demo/server/demo.service.ts";
const CLIENT = "src/features/demo/client/demo-form/demo-form.tsx";

describe("layer import rules", () => {
  it.each([
    ["ORM package in a service", SERVICE, 'import { PrismaClient } from "@prisma/client";'],
    [
      "generated client by alias in a service",
      SERVICE,
      'import { PrismaClient } from "@/generated/prisma/client";',
    ],
    [
      "generated client by relative path in a service",
      SERVICE,
      'import { PrismaClient } from "../../../generated/prisma/client";',
    ],
    [
      "generated client in server infrastructure",
      "src/server/http/route-handler.ts",
      'import { PrismaClient } from "@/generated/prisma/client";',
    ],
    ["server code in a client component", CLIENT, 'import { getDb } from "@/server/db";'],
    [
      "ORM in a client component",
      CLIENT,
      'import { PrismaClient } from "@/generated/prisma/client";',
    ],
    [
      "feature server code in shared UI",
      "src/shared/components/x/x.tsx",
      'import { list } from "@/features/demo/server/demo.service";',
    ],
    [
      "server code by relative path in shared code",
      "src/shared/lib/x.ts",
      'import { getDb } from "../../server/db";',
    ],
  ])("fails lint: %s", async (_name, filePath, code) => {
    expect(await restrictedImportErrors(filePath, `${code}\nexport {};\n`)).not.toHaveLength(0);
  });

  it.each([
    [
      "repository file",
      "src/features/demo/server/demo.repository.ts",
      'import { PrismaClient } from "@/generated/prisma/client";',
    ],
    [
      "database module",
      "src/server/db.ts",
      'import { PrismaPg } from "@prisma/adapter-pg";\nimport { PrismaClient } from "@/generated/prisma/client";',
    ],
    [
      "type-only server import in shared code",
      "src/shared/lib/error-messages.ts",
      'import type { ErrorCode } from "@/server/http/error-codes";',
    ],
    [
      "seed script",
      "prisma/seed.ts",
      'import { PrismaClient } from "../src/generated/prisma/client.ts";',
    ],
    ["integration test setup", "tests/integration/setup/global-setup.ts", 'import pg from "pg";'],
  ])("passes lint: %s", async (_name, filePath, code) => {
    expect(await restrictedImportErrors(filePath, `${code}\nexport {};\n`)).toHaveLength(0);
  });
});
