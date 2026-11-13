import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnitsPage } from "@/features/units/client/units-page";
import { useUnitsPage } from "@/features/units/client/units-page/use-units-page";
import type { UnitDto } from "@/features/units/units.types";
import { formatRiyals } from "@/shared/lib/money";
import type { Role } from "@/shared/lib/roles";

vi.mock("@/features/units/client/units-page/use-units-page", () => ({ useUnitsPage: vi.fn() }));

const unit: UnitDto = {
  id: "00000000-0000-4000-8000-000000000001",
  projectName: "مشروع الاختبار",
  number: "A-1",
  type: "APARTMENT",
  area: 120,
  rooms: 3,
  price: 50000000,
  status: "AVAILABLE",
  reservedUntil: null,
};

function renderPage(
  overrides: Record<string, unknown> = {},
  role: Role = "MANAGER",
  resultOverrides: Record<string, unknown> = {},
) {
  vi.mocked(useUnitsPage).mockReturnValue({
    query: { page: 1, pageSize: 20, order: "asc" },
    valid: true,
    hasFilters: false,
    setFilters: vi.fn(),
    setPage: vi.fn(),
    ...overrides,
    result: {
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
      data: { items: [unit], total: 1, page: 1, pageSize: 20 },
      ...resultOverrides,
    },
  } as unknown as ReturnType<typeof useUnitsPage>);
  return renderToStaticMarkup(createElement(UnitsPage, { role }));
}

beforeEach(() => vi.clearAllMocks());

describe("UnitsPage", () => {
  it("renders the unit, translated labels, money and manager links", () => {
    const html = renderPage();
    expect(html).toContain(unit.projectName);
    expect(html).toContain("شقة");
    expect(html).toContain("متاحة");
    expect(html).toContain(formatRiyals(unit.price));
    expect(html).toContain('href="/units/new"');
    expect(html).toContain(`href="/units/${unit.id}/edit"`);
    expect(html).toContain('dir="ltr"');
  });

  it.each(["SALES", "ACCOUNTANT"] as const)("hides add and edit links from %s", (role) => {
    const html = renderPage({}, role);
    expect(html).not.toContain('href="/units/new"');
    expect(html).not.toContain(`/units/${unit.id}/edit`);
  });

  it("shows invalid URL reset without rendering the data or filters", () => {
    const html = renderPage({ valid: false });
    expect(html).toContain('href="/units"');
    expect(html).toContain("معايير البحث غير صحيحة");
    expect(html).not.toContain(unit.projectName);
    expect(html).not.toContain("<form");
  });

  it("shows the loading skeleton", () => {
    const html = renderPage({}, "MANAGER", { isPending: true });
    expect(html).toContain("جارٍ التحميل");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(unit.projectName);
  });

  it("shows an error with a retry action", () => {
    const html = renderPage({}, "MANAGER", { isError: true });
    expect(html).toContain("تعذر تحميل الوحدات");
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain(unit.projectName);
  });

  it("shows empty filtered results with a clear link and keeps pagination", () => {
    const html = renderPage({ hasFilters: true }, "MANAGER", { data: { items: [], total: 3 } });
    expect(html).toContain("لا توجد وحدات مطابقة");
    expect(html).toContain('href="/units"');
    expect(html).toContain("التنقل بين الصفحات");
  });

  it("marks previous results busy and dims them", () => {
    const html = renderPage({}, "MANAGER", { isPlaceholderData: true });
    expect(html).toContain(unit.projectName);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("opacity-50");
  });
});
