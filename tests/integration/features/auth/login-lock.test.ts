import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginHandler } from "@/features/auth/server/auth.routes";
import { getDb } from "@/server/db";
import { loginFailures } from "../../support/audit";
import { makeCompany, makeLoginFailure, makeUserWithPassword } from "../../support/db-fixtures";
import { apiRequest, readJson } from "../../support/http";

const PASSWORD = "AqarLite#2026";
let account: Awaited<ReturnType<typeof makeUserWithPassword>>;

function attempt(email = account.email, password = "wrong-password") {
  return loginHandler(
    apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
    undefined,
  );
}

async function wrongAttempts(count: number, email = account.email) {
  for (let i = 0; i < count; i++) expect((await attempt(email)).status).toBe(401);
}

async function seedFailures(createdAt: Date) {
  for (let i = 0; i < 5; i++) {
    await makeLoginFailure({
      email: account.email,
      reason: "invalid_credentials",
      createdAt,
      userId: account.user.id,
      companyId: account.user.companyId,
    });
  }
}

beforeEach(async () => {
  const company = await makeCompany();
  account = await makeUserWithPassword(company.id, PASSWORD);
});
afterEach(() => vi.useRealTimers());

describe("per-email login lock", () => {
  it("allows the correct password after four failures", async () => {
    await wrongAttempts(4);
    expect((await attempt(account.email, PASSWORD)).status).toBe(200);
  });

  it("refuses the correct sixth attempt and audits five invalid credentials and one lock", async () => {
    await wrongAttempts(5);
    const response = await attempt(account.email, PASSWORD);
    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
      },
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(getDb().session.count({ where: { userId: account.user.id } })).resolves.toBe(0);
    const rows = await loginFailures(account.email);
    expect(rows.map((row) => row.meta.reason)).toEqual([
      ...Array<string>(5).fill("invalid_credentials"),
      "locked",
    ]);
  });

  it("does not extend the window with locked retries", async () => {
    const now = new Date();
    await seedFailures(new Date(now.getTime() - 14 * 60_000));
    for (let i = 0; i < 5; i++) {
      expect((await attempt(account.email, PASSWORD)).status).toBe(401);
    }
    const rows = await loginFailures(account.email);
    expect(rows).toHaveLength(10);
    expect(rows.slice(5).map((row) => row.meta.reason)).toEqual(Array(5).fill("locked"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now.getTime() + 2 * 60_000));
    expect((await attempt(account.email, PASSWORD)).status).toBe(200);
    expect(await loginFailures(account.email)).toHaveLength(10);
  });

  it("expires failures older than fifteen minutes", async () => {
    await seedFailures(new Date(Date.now() - 16 * 60_000));
    expect((await attempt(account.email, PASSWORD)).status).toBe(200);
  });

  it("locks unknown emails in the same way", async () => {
    const email = `${randomUUID()}@unknown.test`;
    await wrongAttempts(5, email);
    expect((await attempt(email)).status).toBe(401);
    const rows = await loginFailures(email);
    expect(rows).toHaveLength(6);
    expect(rows[5]).toMatchObject({
      companyId: null,
      userId: null,
      meta: { email, reason: "locked" },
    });
  });

  it("counts case and space variants as one email", async () => {
    const variants = [
      account.email.toUpperCase(),
      ` ${account.email} `,
      ` ${account.email.toUpperCase()} `,
    ];
    for (let i = 0; i < 5; i++) expect((await attempt(variants[i % 3]!)).status).toBe(401);
    expect((await attempt(account.email, PASSWORD)).status).toBe(401);
    const rows = await loginFailures(account.email);
    expect(rows).toHaveLength(6);
    expect(rows[5]!.meta).toEqual({ email: account.email, reason: "locked" });
  });

  it("does not lock another email", async () => {
    await wrongAttempts(5);
    const other = await makeUserWithPassword(account.user.companyId, PASSWORD);
    expect((await attempt(other.email, PASSWORD)).status).toBe(200);
  });

  it("serializes eight parallel attempts into five guesses and three locked refusals", async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => attempt()));
    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(401));
    const rows = await loginFailures(account.email);
    expect(rows).toHaveLength(8);
    expect(rows.filter((row) => row.meta.reason === "invalid_credentials")).toHaveLength(5);
    expect(rows.filter((row) => row.meta.reason === "locked")).toHaveLength(3);
    await expect(getDb().session.count({ where: { userId: account.user.id } })).resolves.toBe(0);
  });
});
