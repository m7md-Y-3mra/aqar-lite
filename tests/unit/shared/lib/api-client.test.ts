import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "@/shared/lib/api-client";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("returns data", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: { id: "unit-1" } }));
    vi.stubGlobal("fetch", fetch);

    expect(await apiFetch<{ id: string }>("/api/units")).toEqual({ id: "unit-1" });
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  it("sends JSON content type when a body is given and preserves other headers", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: { id: "unit-1" } }));
    vi.stubGlobal("fetch", fetch);
    const body = JSON.stringify({ price: 150050 });

    await apiFetch("/api/units", {
      method: "POST",
      headers: new Headers({ "Idempotency-Key": "key-1" }),
      body,
    });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/units");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(body);
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("key-1");
  });

  it("throws ApiError with code and fieldErrors", async () => {
    const fieldErrors = { number: ["رقم الوحدة مستخدم"] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: { code: "VALIDATION_ERROR", message: "بيانات غير صحيحة", fieldErrors },
          },
          { status: 400 },
        ),
      ),
    );

    const result = apiFetch("/api/units");
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "بيانات غير صحيحة",
      fieldErrors,
    });
  });

  it.each([200, 502])("maps a non-JSON body at status %i to a generic ApiError", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>upstream failure</html>", { status })),
    );

    const result = apiFetch("/api/units");
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status,
      code: "INTERNAL_ERROR",
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  });
});
