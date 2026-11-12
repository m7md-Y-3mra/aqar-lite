import { beforeEach, describe, expect, it } from "vitest";

import { loginHandler } from "@/features/auth/server/auth.routes";
import { hashSessionToken, SESSION_TTL_MS } from "@/server/auth/session-token";
import { getDb } from "@/server/db";
import { makeCompany, makeUserWithPassword } from "../../support/db-fixtures";
import { apiRequest, getSetCookie, readJson } from "../../support/http";

const PASSWORD = "AqarLite#2026";

let user: Awaited<ReturnType<typeof makeUserWithPassword>>["user"];
let email: string;

async function postLogin(body: unknown) {
  return loginHandler(apiRequest("/api/auth/login", { method: "POST", body }), undefined);
}

function cookieToken(response: Response) {
  const cookie = getSetCookie(response);
  const token = /^aqar_session=([A-Za-z0-9_-]{43});/.exec(cookie)?.[1];
  expect(token).toBeDefined();
  return { cookie, token: token! };
}

beforeEach(async () => {
  const company = await makeCompany();
  ({ user, email } = await makeUserWithPassword(company.id, PASSWORD, "SALES"));
});

describe("POST /api/auth/login", () => {
  it("returns the shell user and a secure session cookie", async () => {
    const before = Date.now();
    const response = await postLogin({ email, password: PASSWORD });
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      data: { name: user.name, role: user.role, companyName: "شركة اختبار" },
    });

    const { cookie, token } = cookieToken(response);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");

    const sessions = await getDb().session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(hashSessionToken(token));
    expect(sessions[0]?.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + SESSION_TTL_MS - 5_000,
    );
    expect(sessions[0]?.expiresAt.getTime()).toBeLessThanOrEqual(after + SESSION_TTL_MS + 5_000);
  });

  it("accepts an upper-case email surrounded by spaces", async () => {
    const response = await postLogin({ email: `  ${email.toUpperCase()}  `, password: PASSWORD });

    expect(response.status).toBe(200);
  });

  it("creates a separate session for each login", async () => {
    const first = await postLogin({ email, password: PASSWORD });
    const second = await postLogin({ email, password: PASSWORD });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(cookieToken(first).token).not.toBe(cookieToken(second).token);
    await expect(getDb().session.count({ where: { userId: user.id } })).resolves.toBe(2);
  });

  it("returns generic invalid credentials and creates no session for a wrong password", async () => {
    const response = await postLogin({ email, password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
      },
    });
    await expect(getDb().session.count({ where: { userId: user.id } })).resolves.toBe(0);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns validation errors for malformed JSON", async () => {
    const response = await postLogin("{not json");

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns field errors for invalid input", async () => {
    const response = await postLogin({ email: "invalid", password: "" });
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { email: expect.any(Array), password: expect.any(Array) },
      },
    });
  });
});
