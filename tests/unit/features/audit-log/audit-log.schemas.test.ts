import { describe, expect, it } from "vitest";

import { auditLogListQuerySchema } from "@/features/audit-log/audit-log.schemas";

describe("auditLogListQuerySchema", () => {
  it("defaults to the first page with twenty rows", () => {
    expect(auditLogListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("parses valid query strings at the bounds", () => {
    expect(auditLogListQuerySchema.parse({ page: "100000", pageSize: "50" })).toEqual({
      page: 100_000,
      pageSize: 50,
    });
  });

  it.each(["0", "abc", "-1", "1.5", "100001"])("rejects invalid page %j", (page) => {
    expect(auditLogListQuerySchema.safeParse({ page }).success).toBe(false);
  });

  it.each(["0", "51", "abc", "-1", "1.5"])("rejects invalid pageSize %j", (pageSize) => {
    expect(auditLogListQuerySchema.safeParse({ pageSize }).success).toBe(false);
  });

  it("strips unknown keys rather than accepting a caller's company scope", () => {
    expect(auditLogListQuerySchema.parse({ companyId: "another-company", sort: "asc" })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});
