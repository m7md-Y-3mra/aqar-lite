import { Writable } from "node:stream";
import { expect, it, vi } from "vitest";

import { loginHandler } from "@/features/auth/server/auth.routes";
import { getDb } from "@/server/db";
import { apiRequest, readJson } from "../../support/http";

const capture = vi.hoisted(() => ({ text: "" }));

vi.mock("@/features/auth/server/auth.repository", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/auth/server/auth.repository")>();
  return {
    ...original,
    findUserByEmail: vi.fn().mockRejectedValue(new Error("Database unavailable")),
  };
});

vi.mock("@/server/logger", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/logger")>();
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      capture.text += String(chunk);
      callback();
    },
  });
  const logger = original.createLogger(destination);
  logger.level = "error";
  return { ...original, logger };
});

it("returns a generic server error without a session or leaked credentials", async () => {
  const password = "NeverLogThisPassword#2026";
  const sessionsBefore = await getDb().session.count();
  const response = await loginHandler(
    apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: "failure@example.test", password },
      cookie: "aqar_session=never-log-this-cookie",
    }),
    undefined,
  );
  expect(response.status).toBe(500);
  expect(await readJson(response)).toEqual({
    error: {
      code: "INTERNAL_ERROR",
      message: "حدث خطأ غير متوقع، حاول مرة أخرى",
    },
  });
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await getDb().session.count()).toBe(sessionsBefore);
  expect(capture.text).toContain("Database unavailable");
  expect(capture.text).not.toContain(password);
  expect(capture.text).not.toContain("aqar_session");
  expect(capture.text).not.toContain("never-log-this-cookie");
});
