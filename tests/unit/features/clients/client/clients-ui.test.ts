import { useQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsPage } from "@/features/clients/client/clients-page";
import { useClientsPage } from "@/features/clients/client/clients-page/use-clients-page";
import { ClientDetails } from "@/features/clients/client/client-details";
import type { Role } from "@/shared/lib/roles";

vi.mock("@/features/clients/client/clients-page/use-clients-page", () => ({
  useClientsPage: vi.fn(),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: vi.fn(),
}));
const client = {
  id: "client-id",
  name: "اسم العميل",
  phone: "0500000000",
  notes: "<b>مهم</b>\n<script>alert(1)</script>",
  salesRep: { id: "rep", name: "اسم المندوب" },
};
function page(role: Role = "SALES", result: Record<string, unknown> = {}, valid = true) {
  vi.mocked(useClientsPage).mockReturnValue({
    query: { page: 1, pageSize: 20 },
    valid,
    setPage: vi.fn(),
    result: {
      data: { items: [client], total: 1 },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
      ...result,
    },
  } as unknown as ReturnType<typeof useClientsPage>);
  return renderToStaticMarkup(createElement(ClientsPage, { role }));
}
function detail(role: Role = "SALES", result: Record<string, unknown> = {}) {
  vi.mocked(useQuery).mockReturnValue({
    data: client,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...result,
  } as unknown as ReturnType<typeof useQuery>);
  return renderToStaticMarkup(createElement(ClientDetails, { id: client.id, role }));
}
beforeEach(() => vi.clearAllMocks());
describe("client views", () => {
  it("links client names and shows add only for SALES", () => {
    const html = page();
    expect(html).toContain('href="/clients/client-id"');
    expect(html).toContain('href="/clients/new"');
    expect(html).toContain('dir="ltr"');
    expect(html).not.toContain(client.salesRep.name);
  });
  it.each(["MANAGER", "ACCOUNTANT"] as const)(
    "shows owner and read-only actions for %s",
    (role) => {
      expect(page(role)).toContain(client.salesRep.name);
      expect(page(role)).not.toContain("/clients/new");
      expect(detail(role)).toContain(client.salesRep.name);
      expect(detail(role)).not.toContain("/edit");
    },
  );
  it("renders notes escaped as plain text while preserving line breaks", () => {
    const html = detail();
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("&lt;b&gt;مهم&lt;/b&gt;\n&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="/clients/client-id/edit"');
  });
  it("shows an empty notes fallback", () =>
    expect(detail("SALES", { data: { ...client, notes: null } })).toContain("لا توجد ملاحظات"));
  it("shows list loading, error, empty, invalid URL and stale states", () => {
    expect(page("SALES", { isPending: true })).toContain("جارٍ التحميل");
    expect(page("SALES", { isError: true })).toContain("إعادة المحاولة");
    expect(page("SALES", { data: { items: [], total: 0 } })).toContain("لا يوجد عملاء");
    expect(page("SALES", {}, false)).toContain('href="/clients"');
    expect(page("SALES", { isPlaceholderData: true })).toContain("opacity-50");
  });
  it("shows detail loading and retry states", () => {
    expect(detail("SALES", { isPending: true })).toContain("جارٍ التحميل");
    expect(detail("SALES", { isError: true })).toContain("إعادة المحاولة");
  });
});
