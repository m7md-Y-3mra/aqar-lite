import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { unitDetailOptions, unitListOptions } from "@/features/units/client/units.queries";
import { unitKeys } from "@/features/units/units.keys";
import type { UnitDto, UnitListQuery, UnitPage } from "@/features/units/units.types";

const unit: UnitDto = {
  id: "11111111-1111-4111-8111-111111111111",
  projectName: "مشروع الأفق",
  number: "١٠١",
  type: "APARTMENT",
  area: 120,
  rooms: 3,
  price: 50_000_000,
  status: "AVAILABLE",
};

const query: UnitListQuery = { page: 1, pageSize: 20, order: "asc" };

afterEach(() => vi.unstubAllGlobals());

describe("units query options", () => {
  it("uses the list key factory with the complete query", () => {
    const filtered: UnitListQuery = { ...query, status: "RESERVED", sort: "price" };

    expect(unitListOptions(filtered).queryKey).toEqual(unitKeys.list(filtered));
  });

  it("uses the detail key factory with the unit id", () => {
    expect(unitDetailOptions(unit.id).queryKey).toEqual(unitKeys.detail(unit.id));
  });

  it("requests the units list and returns the data from the API envelope", async () => {
    const page: UnitPage = { items: [unit], total: 1, page: 1, pageSize: 20 };
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: page }));
    vi.stubGlobal("fetch", fetch);

    expect(await new QueryClient().fetchQuery(unitListOptions(query))).toEqual(page);

    const url = new URL(fetch.mock.calls[0]?.[0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/units");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "1",
      pageSize: "20",
      order: "asc",
    });
  });

  it("serializes only defined values and keeps a zero minimum price", async () => {
    const filtered: UnitListQuery = {
      status: "AVAILABLE",
      minPrice: 0,
      maxPrice: undefined,
      sort: "area",
      order: "desc",
      page: 2,
      pageSize: 10,
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { items: [], total: 0, page: 2, pageSize: 10 } }));
    vi.stubGlobal("fetch", fetch);

    await new QueryClient().fetchQuery(unitListOptions(filtered));

    const url = new URL(fetch.mock.calls[0]?.[0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/units");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "AVAILABLE",
      minPrice: "0",
      sort: "area",
      order: "desc",
      page: "2",
      pageSize: "10",
    });
    expect(url.search).not.toContain("undefined");
  });

  it("requests the detail endpoint and returns the data from the API envelope", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: unit }));
    vi.stubGlobal("fetch", fetch);

    expect(await new QueryClient().fetchQuery(unitDetailOptions(unit.id))).toEqual(unit);
    expect(fetch.mock.calls[0]?.[0]).toBe(`/api/units/${unit.id}`);
  });
});
