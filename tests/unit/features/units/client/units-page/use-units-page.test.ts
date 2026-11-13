import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnitsPage } from "@/features/units/client/units-page/use-units-page";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  usePathname: () => "/units",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: vi.fn(() => ({})),
}));

function pushedParams() {
  const href = navigation.push.mock.lastCall?.[0] as string;
  return new URL(href, "http://localhost").searchParams;
}

beforeEach(() => {
  navigation.search = "";
  vi.clearAllMocks();
});

describe("useUnitsPage", () => {
  it("uses parsed defaults and keeps previous data", () => {
    const page = useUnitsPage();
    expect(page.valid).toBe(true);
    expect(page.query).toEqual({ page: 1, pageSize: 20, order: "asc" });
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        placeholderData: keepPreviousData,
        queryKey: ["units", "list", page.query],
      }),
    );
  });

  it.each(["pageSize=51", "minPrice=9&maxPrice=1", "status=INVALID", "page=1&page=2"])(
    "disables fetching for invalid URL %s",
    (search) => {
      navigation.search = search;
      expect(useUnitsPage().valid).toBe(false);
      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    },
  );

  it("changes filters, resets the page, and omits defaults", () => {
    navigation.search = "page=5&pageSize=2&sort=price&order=desc";
    useUnitsPage().setFilters({ status: "AVAILABLE", minPrice: 0, order: "asc" });
    expect(Object.fromEntries(pushedParams())).toEqual({
      status: "AVAILABLE",
      minPrice: "0",
      sort: "price",
      pageSize: "2",
    });
  });

  it("changes page while preserving filters and sort", () => {
    navigation.search = "status=SOLD&maxPrice=50000000&sort=area&order=desc";
    useUnitsPage().setPage(2);
    expect(Object.fromEntries(pushedParams())).toEqual({
      status: "SOLD",
      maxPrice: "50000000",
      sort: "area",
      order: "desc",
      page: "2",
    });
  });

  it("clears defined filters without writing undefined or default values", () => {
    navigation.search = "status=AVAILABLE&minPrice=100&maxPrice=200&sort=area&order=desc&page=3";
    useUnitsPage().setFilters({
      status: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: undefined,
      order: "asc",
    });
    expect(navigation.push).toHaveBeenCalledWith("/units");
  });

  it("reads fresh URL values after back navigation", () => {
    navigation.search = "status=RESERVED&minPrice=500&page=2";
    expect(useUnitsPage().query).toMatchObject({ status: "RESERVED", minPrice: 500, page: 2 });
    navigation.search = "";
    expect(useUnitsPage().query).toEqual({ page: 1, pageSize: 20, order: "asc" });
  });

  it("openReserve keeps the current params and adds reserve with a shallow replace", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", { history: { replaceState } });
    navigation.search = "page=2&status=AVAILABLE";
    useUnitsPage().openReserve("11111111-1111-4111-8111-111111111111");
    const url = new URL(replaceState.mock.lastCall?.[2] as string, "http://localhost");
    expect(url.pathname).toBe("/units");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      status: "AVAILABLE",
      reserve: "11111111-1111-4111-8111-111111111111",
    });
    expect(navigation.replace).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
