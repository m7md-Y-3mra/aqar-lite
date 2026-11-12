import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError } from "@/server/http/app-error";
import { handleRoute, readJson } from "@/server/http/route-handler";
import { logger } from "@/server/logger";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";

const ORIGIN = "http://localhost:3000";
const URL_ = "http://localhost:3000/api/demo";

function post(headers: Record<string, string> = {}, body = "{}") {
  return new Request(URL_, { method: "POST", headers, body });
}

const ok = handleRoute({ auth: "public", handler: async () => ({ data: { ok: true } }) });

afterEach(() => {
  vi.restoreAllMocks();
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

  it("accepts a POST from the app origin", async () => {
    const res = await ok(post({ Origin: ORIGIN }), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { ok: true } });
  });

  it("does not require Origin on GET", async () => {
    const res = await ok(new Request(URL_), undefined);
    expect(res.status).toBe(200);
  });
});

describe("handleRoute auth", () => {
  it("fails closed for user routes until sessions exist", async () => {
    const handler = vi.fn(async () => ({ data: null }));
    const res = await handleRoute({ auth: "user", handler })(new Request(URL_), undefined);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
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
