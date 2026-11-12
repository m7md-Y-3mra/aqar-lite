"use client";

import { useState, type FormEvent } from "react";

import type { UnitListQuery } from "../../../../units.types";
import type { UnitsFiltersProps } from "./types";

export function useUnitsFilters({ query, onApply }: UnitsFiltersProps) {
  const [status, setStatus] = useState<UnitListQuery["status"]>(query.status);
  const [minPrice, setMinPrice] = useState(query.minPrice);
  const [maxPrice, setMaxPrice] = useState(query.maxPrice);
  const [sort, setSort] = useState<UnitListQuery["sort"]>(query.sort);
  const [order, setOrder] = useState(query.order);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({
      status,
      minPrice: Number.isNaN(minPrice) ? undefined : minPrice,
      maxPrice: Number.isNaN(maxPrice) ? undefined : maxPrice,
      sort,
      order,
    });
  }

  function onClear() {
    setStatus(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setSort(undefined);
    setOrder("asc");
    onApply({
      status: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: undefined,
      order: "asc",
    });
  }

  return {
    status,
    setStatus,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    sort,
    setSort,
    order,
    setOrder,
    onSubmit,
    onClear,
  };
}
