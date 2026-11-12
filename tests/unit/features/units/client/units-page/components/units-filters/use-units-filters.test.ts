import { createElement, type FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { useUnitsFilters } from "@/features/units/client/units-page/components/units-filters/use-units-filters";
import type { UnitListQuery } from "@/features/units/units.types";

function renderFilters(query: UnitListQuery) {
  const onApply = vi.fn();
  let filters!: ReturnType<typeof useUnitsFilters>;
  function Harness() {
    filters = useUnitsFilters({ query, onApply });
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  return { filters, onApply };
}

function submit(filters: ReturnType<typeof useUnitsFilters>) {
  const preventDefault = vi.fn();
  filters.onSubmit({ preventDefault } as unknown as FormEvent<HTMLFormElement>);
  expect(preventDefault).toHaveBeenCalledOnce();
}

describe("useUnitsFilters", () => {
  it("seeds the local form and submits prices as integer halalas", () => {
    const { filters, onApply } = renderFilters({
      page: 2,
      pageSize: 20,
      status: "AVAILABLE",
      minPrice: 40000000,
      maxPrice: 60000000,
      sort: "area",
      order: "desc",
    });
    expect(filters.status).toBe("AVAILABLE");
    expect(filters.minPrice).toBe(40000000);
    expect(filters.maxPrice).toBe(60000000);
    submit(filters);
    expect(onApply).toHaveBeenCalledWith({
      status: "AVAILABLE",
      minPrice: 40000000,
      maxPrice: 60000000,
      sort: "area",
      order: "desc",
    });
  });

  it.each([undefined, NaN])("treats empty or NaN price %s as no filter", (price) => {
    const { filters, onApply } = renderFilters({
      page: 1,
      pageSize: 20,
      order: "asc",
      minPrice: price,
      maxPrice: price,
    });
    submit(filters);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ minPrice: undefined, maxPrice: undefined }),
    );
  });

  it("preserves a zero price filter", () => {
    const { filters, onApply } = renderFilters({
      page: 1,
      pageSize: 20,
      order: "asc",
      minPrice: 0,
    });
    submit(filters);
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ minPrice: 0 }));
  });

  it("clear removes all filters and resets sorting", () => {
    const { filters, onApply } = renderFilters({
      page: 3,
      pageSize: 2,
      order: "desc",
      status: "SOLD",
      minPrice: 100,
      sort: "price",
    });
    filters.onClear();
    expect(onApply).toHaveBeenCalledWith({
      status: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: undefined,
      order: "asc",
    });
  });
});
