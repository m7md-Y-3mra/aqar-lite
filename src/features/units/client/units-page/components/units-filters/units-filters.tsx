"use client";

import { SlidersHorizontal, X } from "lucide-react";

import { MoneyInput } from "@/shared/components/money-input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/shared/components/ui/native-select";
import type { UnitListQuery } from "../../../../units.types";
import { UNIT_STATUS_LABELS } from "../../../unit-labels";
import type { UnitsFiltersProps } from "./types";
import { useUnitsFilters } from "./use-units-filters";

export function UnitsFilters(props: UnitsFiltersProps) {
  const filters = useUnitsFilters(props);

  return (
    <form
      onSubmit={filters.onSubmit}
      aria-label="تصفية الوحدات"
      className="rounded-xl border bg-card p-4 shadow-xs md:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="unit-status">الحالة</Label>
          <NativeSelect
            className="w-full"
            id="unit-status"
            name="status"
            value={filters.status ?? ""}
            onChange={(event) =>
              filters.setStatus((event.target.value || undefined) as UnitListQuery["status"])
            }
          >
            <NativeSelectOption value="">الكل</NativeSelectOption>
            {Object.entries(UNIT_STATUS_LABELS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit-min-price">الحد الأدنى للسعر (ريال)</Label>
          <MoneyInput
            id="unit-min-price"
            name="minPrice"
            value={filters.minPrice}
            onChange={filters.setMinPrice}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit-max-price">الحد الأعلى للسعر (ريال)</Label>
          <MoneyInput
            id="unit-max-price"
            name="maxPrice"
            value={filters.maxPrice}
            onChange={filters.setMaxPrice}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit-sort">الترتيب حسب</Label>
          <NativeSelect
            className="w-full"
            id="unit-sort"
            name="sort"
            value={filters.sort ?? ""}
            onChange={(event) =>
              filters.setSort((event.target.value || undefined) as UnitListQuery["sort"])
            }
          >
            <NativeSelectOption value="">بدون</NativeSelectOption>
            <NativeSelectOption value="price">السعر</NativeSelectOption>
            <NativeSelectOption value="area">المساحة</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit-order">اتجاه الترتيب</Label>
          <NativeSelect
            className="w-full"
            id="unit-order"
            name="order"
            value={filters.order}
            onChange={(event) => filters.setOrder(event.target.value as UnitListQuery["order"])}
          >
            <NativeSelectOption value="asc">تصاعدي</NativeSelectOption>
            <NativeSelectOption value="desc">تنازلي</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={filters.onClear}>
          <X aria-hidden="true" />
          مسح الفلاتر
        </Button>
        <Button type="submit">
          <SlidersHorizontal aria-hidden="true" />
          تطبيق
        </Button>
      </div>
    </form>
  );
}
