import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useClientsPage } from "@/features/clients/client/clients-page/use-clients-page";

const navigation = vi.hoisted(() => ({ push: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: vi.fn(() => ({})),
}));
beforeEach(() => {
  navigation.search = "";
  vi.clearAllMocks();
});
describe("useClientsPage", () => {
  it("uses defaults and keeps previous data", () => {
    const page = useClientsPage();
    expect(page.query).toEqual({ page: 1, pageSize: 20 });
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        placeholderData: keepPreviousData,
        queryKey: ["clients", "list", page.query],
      }),
    );
  });
  it.each(["pageSize=51", "page=0", "page=1&page=2"])(
    "rejects invalid URL %s without fetching",
    (search) => {
      navigation.search = search;
      expect(useClientsPage().valid).toBe(false);
      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    },
  );
  it("preserves pageSize when changing the URL page", () => {
    navigation.search = "page=3&pageSize=2";
    useClientsPage().setPage(4);
    expect(navigation.push).toHaveBeenCalledWith("/clients?page=4&pageSize=2");
  });
  it("omits defaults and reads fresh values after back navigation", () => {
    navigation.search = "page=2";
    useClientsPage().setPage(1);
    expect(navigation.push).toHaveBeenCalledWith("/clients");
    navigation.search = "";
    expect(useClientsPage().query).toEqual({ page: 1, pageSize: 20 });
  });
});
