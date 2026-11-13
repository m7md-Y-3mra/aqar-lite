import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getRequestUser } from "@/server/auth/request-user";
import type { SessionUser } from "@/server/auth/session.service";
import { AppError } from "@/server/http/app-error";
import { handleRoute, readJson } from "@/server/http/route-handler";
import { logger } from "@/server/logger";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";

vi.mock("@/server/auth/request-user", () => ({ getRequestUser: vi.fn() }));

const ORIGIN = "http://localhost:3000";
const URL_ = "http://localhost:3000/api/demo";
const USER: SessionUser = {
  userId: "user-id",
  companyId: "company-id",
  role: "MANAGER",
  name: "مستخدم اختبار",
  companyName: "شركة اختبار",
};

function post(headers: Record<string, string> = {}, body = "{}") {
  return new Request(URL_, { method: "POST", headers, body });
}

const ok = handleRoute({ auth: "public", handler: async () => ({ data: { ok: true } }) });

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getRequestUser).mockReset();
});

describe("handleRoute origin check", () => {
  it("rejects a POST with no Origin header", async () => {
    const res = await ok(post(), undefined);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("INVALID_ORIGIN");
  });

  it("rejects a POST from another origin", async () => {
    const res = await ok(post({ Origin: "https://evil.example" }), undefined);
    expect(res.status).toBe(403);
  });

  it.each([ORIGIN, "http://127.0.0.1:3000"])(
    "accepts a POST from a listed origin: %s",
    async (origin) => {
      const res = await ok(post({ Origin: origin }), undefined);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ data: { ok: true } });
    },
  );

  it.each([
    "http://localhost:3000,http://127.0.0.1:3000",
    "http://localhost:3000/",
    "http://localhost:30001",
    "http://localhost",
    "null",
  ])("rejects an Origin that only resembles a listed one: %s", async (origin) => {
    const res = await ok(post({ Origin: origin }), undefined);
    expect(res.status).toBe(403);
  });

  it("does not require Origin on GET", async () => {
    const res = await ok(new Request(URL_), undefined);
    expect(res.status).toBe(200);
  });
});

describe("handleRoute auth", () => {
  it("returns unauthorized without calling the handler when no user exists", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);
    const handler = vi.fn(async () => ({ data: null }));
    const res = await handleRoute({ auth: "user", handler })(new Request(URL_), undefined);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the resolved user to a user route handler", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(USER);
    const handler = vi.fn(async (_req: Request, _ctx: undefined, user: SessionUser) => ({
      data: user,
    }));

    const res = await handleRoute({ auth: "user", handler })(new Request(URL_), undefined);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.any(Request), undefined, USER);
  });

  it("checks a mutating request's origin before resolving its user", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(USER);
    const handler = vi.fn(async () => ({ data: null }));

    const res = await handleRoute({ auth: "user", handler })(
      post({ Origin: "https://evil.example" }),
      undefined,
    );

    expect(res.status).toBe(403);
    expect(getRequestUser).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("handleRoute error mapping", () => {
  it("maps AppError to its status and Arabic message", async () => {
    const route = handleRoute({
      auth: "public",
      handler: async () => {
        throw new AppError("NOT_FOUND");
      },
    });
    const res = await route(new Request(URL_), undefined);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: ERROR_MESSAGES.NOT_FOUND },
    });
  });

  it("uses an AppError's own user message instead of the default", async () => {
    const route = handleRoute({
      auth: "public",
      handler: async () => {
        throw new AppError("PAYMENT_EXCEEDS_REMAINING", undefined, "المتبقي: ١٠ ريال");
      },
    });
    const res = await route(new Request(URL_), undefined);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "PAYMENT_EXCEEDS_REMAINING", message: "المتبقي: ١٠ ريال" },
    });
  });

  it("maps ZodError to 400 with field errors", async () => {
    const route = handleRoute({
      auth: "public",
      handler: async (req) => ({ data: z.object({ name: z.string() }).parse(await readJson(req)) }),
    });
    const res = await route(post({ Origin: ORIGIN }), undefined);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors.name).toBeDefined();
  });

  it("maps a malformed JSON body to 400", async () => {
    const route = handleRoute({
      auth: "public",
      handler: async (req) => ({ data: await readJson(req) }),
    });
    const res = await route(post({ Origin: ORIGIN }, "{not json"), undefined);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("treats a SyntaxError from server code as a server error, not bad input", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const route = handleRoute({
      auth: "public",
      handler: async () => ({ data: JSON.parse("{broken") as unknown }),
    });
    const res = await route(new Request(URL_), undefined);
    expect(res.status).toBe(500);
  });

  it("hides unknown errors behind a generic message and logs the detail", async () => {
    const logSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const route = handleRoute({
      auth: "public",
      handler: async () => {
        throw new Error("db password=secret");
      },
    });
    const res = await route(new Request(URL_), undefined);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(text).not.toContain("secret");
    expect(logSpy).toHaveBeenCalledOnce();
  });
});
