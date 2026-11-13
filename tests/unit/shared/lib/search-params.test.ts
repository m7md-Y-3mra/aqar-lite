import { describe, expect, it } from "vitest";

import { toQueryInput } from "@/shared/lib/search-params";

describe("toQueryInput", () => {
  it("empty string → undefined", () => {
    expect(toQueryInput(new URLSearchParams("page=&status=AVAILABLE"))).toEqual({
      page: undefined,
      status: "AVAILABLE",
    });
    expect(toQueryInput({ page: "", sort: undefined, minPrice: " " })).toEqual({
      page: undefined,
      sort: undefined,
      minPrice: " ",
    });
  });

  it("repeated key → array", () => {
    expect(toQueryInput(new URLSearchParams("status=AVAILABLE&status=SOLD"))).toEqual({
      status: ["AVAILABLE", "SOLD"],
    });
    expect(toQueryInput(new URLSearchParams("page=&page=1"))).toEqual({ page: ["", "1"] });
    expect(toQueryInput({ page: ["1"] })).toEqual({ page: ["1"] });
  });

  it("same result for URLSearchParams and record", () => {
    const record = { status: ["AVAILABLE", "SOLD"], page: "2", minPrice: "", sort: "price" };
    const params = new URLSearchParams("status=AVAILABLE&status=SOLD&page=2&minPrice=&sort=price");
    expect(toQueryInput(params)).toEqual(toQueryInput(record));
    expect(record.minPrice).toBe("");
    expect(params.get("minPrice")).toBe("");
  });

  it("keeps unusual keys as data", () => {
    const result = toQueryInput(new URLSearchParams("__proto__=x&__proto__=y&constructor=z"));
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result["__proto__"]).toEqual(["x", "y"]);
    expect(result["constructor"]).toBe("z");
  });
});
