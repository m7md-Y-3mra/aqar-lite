import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROLES } from "@/shared/lib/roles";

describe("roles", () => {
  it("matches the Role enum in the Prisma schema", () => {
    const schemaPath = fileURLToPath(new URL("../../../../prisma/schema.prisma", import.meta.url));
    const schema = readFileSync(schemaPath, "utf8");
    const roleBlock = /enum Role\s*\{([^}]*)\}/.exec(schema)?.[1];

    expect(roleBlock).toBeDefined();
    const schemaRoles = roleBlock
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    expect(schemaRoles).toEqual([...ROLES]);
  });
});
