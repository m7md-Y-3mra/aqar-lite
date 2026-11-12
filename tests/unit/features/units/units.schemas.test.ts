import { describe, expect, it } from "vitest";

import { unitIdSchema, unitInputSchema, unitListQuerySchema } from "@/features/units/units.schemas";
import { toSkip } from "@/shared/lib/pagination";
import { toQueryInput } from "@/shared/lib/search-params";

const validInput = {
  projectName: "مشروع النخيل",
  number: "A-101",
  type: "APARTMENT",
  area: 120,
  rooms: 3,
  price: 100_000_00,
};

describe("unitInputSchema", () => {
  it("input strips status and companyId", () => {
    expect(
      unitInputSchema.parse({
        ...validInput,
        status: "SOLD",
        companyId: "foreign-company",
        salesRepId: "foreign-rep",
        id: "hand-sent-id",
      }),
    ).toEqual(validInput);
  });

  it.each([
    ["area 0", { area: 0 }],
    ["area 100001", { area: 100001 }],
    ["area 1.5", { area: 1.5 }],
    ["rooms 51", { rooms: 51 }],
    ["rooms -1", { rooms: -1 }],
    ["rooms 1.5", { rooms: 1.5 }],
    ["price 0", { price: 0 }],
    ["price above cap", { price: 100_000_000_001 }],
    ["price fraction", { price: 1.5 }],
    ["empty projectName", { projectName: " " }],
    ["projectName of 101 chars", { projectName: "س".repeat(101) }],
    ["empty number", { number: " " }],
    ["number of 21 chars", { number: "1".repeat(21) }],
    ["unknown type", { type: "LAND" }],
  ])("rejects %s", (_name, patch) => {
    expect(unitInputSchema.safeParse({ ...validInput, ...patch }).success).toBe(false);
  });

  it("trims projectName", () => {
    expect(
      unitInputSchema.parse({ ...validInput, projectName: "  مشروع النخيل  ", number: " A-101 " }),
    ).toEqual(validInput);
  });

  it("accepts inclusive field limits", () => {
    expect(
      unitInputSchema.safeParse({
        ...validInput,
        projectName: "س".repeat(100),
        number: "1".repeat(20),
        area: 100000,
        rooms: 50,
        price: 100_000_000_000,
      }).success,
    ).toBe(true);
    expect(unitInputSchema.safeParse({ ...validInput, area: 1, rooms: 0, price: 1 }).success).toBe(
      true,
    );
  });
});

describe("unitListQuerySchema", () => {
  it("applies defaults", () => {
    expect(unitListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, order: "asc" });
  });

  it.each([
    ["bad status", { status: "FOO" }, "status"],
    ["negative price", { minPrice: "-1" }, "minPrice"],
    ["decimal price", { minPrice: "1.5" }, "minPrice"],
    ["exponential price", { minPrice: "1e3" }, "minPrice"],
    ["whitespace price", { minPrice: " " }, "minPrice"],
    ["hexadecimal price", { minPrice: "0x10" }, "minPrice"],
    ["minPrice > maxPrice", { minPrice: "2", maxPrice: "1" }, "minPrice"],
    ["bad sort", { sort: "rooms" }, "sort"],
    ["bad order", { order: "up" }, "order"],
    ["page 0", { page: "0" }, "page"],
    ["pageSize 51", { pageSize: "51" }, "pageSize"],
    ["pageSize 0", { pageSize: "0" }, "pageSize"],
    ["decimal page", { page: "1.5" }, "page"],
    ["unsafe price", { maxPrice: "9007199254740992" }, "maxPrice"],
    ["price above cap", { maxPrice: "100000000001" }, "maxPrice"],
    ["page above 100000", { page: "100001" }, "page"],
    ["repeated status key", { status: ["AVAILABLE", "SOLD"] }, "status"],
  ])("rejects %s", (_name, query, field) => {
    const parsed = unitListQuerySchema.safeParse(query);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });

  it("ignores unknown params", () => {
    expect(unitListQuerySchema.parse({ companyId: "foreign-company", q: "ignored" })).toEqual(
      unitListQuerySchema.parse({}),
    );
  });

  it("parses inclusive price bounds and pagination from URL strings", () => {
    expect(
      unitListQuerySchema.parse(
        toQueryInput(
          new URLSearchParams(
            "status=AVAILABLE&minPrice=0&maxPrice=0&sort=area&order=desc&page=2&pageSize=50",
          ),
        ),
      ),
    ).toEqual({
      status: "AVAILABLE",
      minPrice: 0,
      maxPrice: 0,
      sort: "area",
      order: "desc",
      page: 2,
      pageSize: 50,
    });
    expect(toSkip(1, 20)).toBe(0);
    expect(toSkip(3, 20)).toBe(40);
  });
});

describe("unitIdSchema", () => {
  it("accepts UUIDs only", () => {
    expect(unitIdSchema.safeParse("f8ec2ac8-4b5c-456d-b8de-a7b7c5068324").success).toBe(true);
    expect(unitIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
