import { describe, expect, it } from "vitest";
import config from "../../next.config";

describe("security headers", () => {
  it("disables framework disclosure and protects every path", async () => {
    expect(config.poweredByHeader).toBe(false);
    const rules = await config.headers!();
    const rule = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(rule!.headers.map(({ key, value }) => [key, value]));
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBeTruthy();
    for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'"]) {
      expect(headers["Content-Security-Policy"]).toContain(directive);
    }
  });
});
