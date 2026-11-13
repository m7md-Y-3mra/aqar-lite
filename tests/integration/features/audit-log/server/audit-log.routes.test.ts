import { beforeEach, describe, expect, it } from "vitest";

import * as auditLogRoute from "@/app/api/audit-log/route";
import type { AuditLogPage } from "@/features/audit-log/audit-log.types";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { getDb } from "@/server/db";
import { makeSession } from "../../../support/db-fixtures";
import { apiRequest, readJson } from "../../../support/http";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
beforeEach(async () => {
  companies = await makeTwoCompanies();
});

async function sessionCookie(userId: string) {
  const token = await makeSession(userId, new Date(Date.now() + 86_400_000));
  return `${SESSION_COOKIE}=${token}`;
}

function getAuditLog(cookie?: string, search = "") {
  return auditLogRoute.GET(apiRequest(`/api/audit-log${search}`, { method: "GET", cookie }), {});
}

describe("GET /api/audit-log", () => {
  it("requires a session", async () => {
    const response = await getAuditLog();
    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it.each(["sales1", "accountant"] as const)("rejects %s", async (role) => {
    const response = await getAuditLog(await sessionCookie(companies.a[role].userId));
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns the manager's JSON-safe company page and ignores supplied companyId", async () => {
    const { a, b } = companies;
    const row = await getDb().auditLog.create({
      data: {
        companyId: a.companyId,
        userId: a.manager.userId,
        action: "LOGIN_FAILED",
        entityId: null,
        meta: {
          email: "typed@example.test",
          reason: "invalid_credentials",
          password: "never-return",
        },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const response = await getAuditLog(
      await sessionCookie(a.manager.userId),
      `?companyId=${b.companyId}`,
    );
    expect(response.status).toBe(200);
    const body = (await readJson(response)) as { data: AuditLogPage };
    expect(body).toEqual({
      data: {
        items: [
          {
            id: row.id,
            action: "LOGIN_FAILED",
            actorName: null,
            createdAt: row.createdAt.toISOString(),
            details: { email: "typed@example.test", reason: "invalid_credentials" },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
  });

  it("rejects pageSize 51 with field errors", async () => {
    const response = await getAuditLog(
      await sessionCookie(companies.a.manager.userId),
      "?pageSize=51",
    );
    expect(response.status).toBe(400);
    const body = (await readJson(response)) as {
      error: { code: string; fieldErrors: Record<string, string[]> };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors.pageSize).toBeDefined();
  });
});

describe("route module", () => {
  it("exports only GET", () => {
    expect(Object.keys(auditLogRoute)).toEqual(["GET"]);
  });
});
