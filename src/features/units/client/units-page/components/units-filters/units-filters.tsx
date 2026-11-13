"use client";

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
      className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="space-y-2">
        <Label htmlFor="unit-status">الحالة</Label>
        <NativeSelect
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
          id="unit-order"
          name="order"
          value={filters.order}
          onChange={(event) => filters.setOrder(event.target.value as UnitListQuery["order"])}
        >
          <NativeSelectOption value="asc">تصاعدي</NativeSelectOption>
          <NativeSelectOption value="desc">تنازلي</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit">تطبيق</Button>
        <Button type="button" variant="outline" onClick={filters.onClear}>
          مسح
        </Button>
      </div>
    </form>
  );
}
