import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { createLogger } from "@/server/logger";

describe("logger redaction", () => {
  it("redacts passwords, tokens, cookies and authorization headers", () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const log = createLogger(stream);
    log.level = "info"; // the unit test env sets LOG_LEVEL=silent

    log.info(
      {
        password: "pw-value",
        user: { passwordHash: "hash-value" },
        token: "token-value",
        headers: { cookie: "cookie-value", authorization: "auth-value" },
      },
      "test",
    );

    const line = lines.join("");
    for (const value of ["pw-value", "hash-value", "token-value", "cookie-value", "auth-value"]) {
      expect(line).not.toContain(value);
    }
    expect(line.match(/\[Redacted\]/g)).toHaveLength(5);
  });
});
