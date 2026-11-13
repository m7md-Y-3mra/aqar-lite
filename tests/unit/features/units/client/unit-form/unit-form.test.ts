import { useMutation, useQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm, type UseFormReturn } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnitForm } from "@/features/units/client/unit-form";
import { unitKeys } from "@/features/units/units.keys";
import { unitInputSchema } from "@/features/units/units.schemas";
import type { UnitDto, UnitInput } from "@/features/units/units.types";
import { ApiError, apiFetch } from "@/shared/lib/api-client";

const actions = vi.hoisted(() => ({
  push: vi.fn(),
  refetch: vi.fn(),
  invalidateQueries: vi.fn(),
  success: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push }) }));
vi.mock("@/shared/lib/query-client", () => ({
  getQueryClient: () => ({ invalidateQueries: actions.invalidateQueries }),
}));
vi.mock("@/shared/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/api-client")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: actions.success } }));
vi.mock("react-hook-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-hook-form")>();
  return { ...actual, useForm: vi.fn(actual.useForm) };
});
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

const unit: UnitDto = {
  id: "00000000-0000-4000-8000-000000000001",
  projectName: "مشروع الاختبار",
  number: "A-1",
  type: "VILLA",
  area: 200,
  rooms: 4,
  price: 50_000_000,
  status: "AVAILABLE",
  reservedUntil: null,
};

function renderEdit() {
  return renderToStaticMarkup(createElement(UnitForm, { mode: "edit", id: unit.id }));
}

function formInstance() {
  return vi.mocked(useForm).mock.results.at(-1)!.value as UseFormReturn<UnitInput>;
}

function mutationOptions() {
  return vi.mocked(useMutation).mock.calls.at(-1)![0] as unknown as {
    mutationFn: (input: UnitInput) => Promise<UnitDto>;
    onSuccess: (data: UnitDto) => Promise<void>;
    onError: (error: Error) => Promise<void>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue(unit);
  actions.refetch.mockResolvedValue({ data: unit });
  vi.mocked(useQuery).mockReturnValue({
    data: unit,
    isPending: false,
    isError: false,
    refetch: actions.refetch,
  } as unknown as ReturnType<typeof useQuery>);
  vi.mocked(useMutation).mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useMutation>);
});

describe("UnitForm", () => {
  it.each(["create", "edit"] as const)(
    "sends the parsed input using the %s endpoint",
    async (mode) => {
      renderToStaticMarkup(
        createElement(UnitForm, mode === "edit" ? { mode, id: unit.id } : { mode }),
      );
      const input = unitInputSchema.parse(unit);
      await mutationOptions().mutationFn(input);
      expect(apiFetch).toHaveBeenCalledWith(
        mode === "edit" ? `/api/units/${unit.id}` : "/api/units",
        { method: mode === "edit" ? "PATCH" : "POST", body: JSON.stringify(input) },
      );
    },
  );

  it.each(["create", "edit"] as const)(
    "invalidates units and navigates after %s success",
    async (mode) => {
      renderToStaticMarkup(
        createElement(UnitForm, mode === "edit" ? { mode, id: unit.id } : { mode }),
      );
      await mutationOptions().onSuccess(unit);
      expect(actions.invalidateQueries).toHaveBeenCalledWith({ queryKey: unitKeys.all });
      expect(actions.success).toHaveBeenCalledWith(
        mode === "edit" ? "تم حفظ التعديلات" : "تمت إضافة الوحدة",
      );
      expect(actions.push).toHaveBeenCalledWith("/units");
    },
  );

  it("maps duplicate errors to the number field", async () => {
    renderEdit();
    const form = formInstance();
    await mutationOptions().onError(
      new ApiError(400, "VALIDATION_ERROR", "رقم مكرر", { number: ["رقم مكرر"] }),
    );
    expect(form.getFieldState("number").error?.message).toBe("رقم مكرر");
    expect(actions.refetch).not.toHaveBeenCalled();
  });

  it.each(["UNIT_PRICE_LOCKED", "UNIT_CHANGED"])(
    "refetches detail and keeps a root error on %s",
    async (code) => {
      renderEdit();
      const form = formInstance();
      actions.refetch.mockResolvedValue({
        data: { ...unit, price: 60_000_000, status: "RESERVED" },
      });
      const setError = vi.spyOn(form, "setError");
      await mutationOptions().onError(new ApiError(409, code, "تغيرت الوحدة"));
      expect(actions.refetch).toHaveBeenCalledOnce();
      expect(setError).toHaveBeenCalledWith(
        "root",
        expect.objectContaining({ message: "تغيرت الوحدة" }),
      );
      expect(form.getValues("price")).toBe(60_000_000);
    },
  );

  it("renders all six fields and the edit defaults", () => {
    const html = renderEdit();
    for (const field of ["projectName", "number", "type", "area", "rooms", "price"]) {
      expect(html).toContain(`name="${field}"`);
    }
    expect(formInstance().getValues()).toEqual(unitInputSchema.parse(unit));
    expect(html).toContain('value="500000"');
  });

  it.each(["RESERVED", "SOLD"] as const)("disables the price for %s and explains why", (status) => {
    vi.mocked(useQuery).mockReturnValue({
      data: { ...unit, status },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    const html = renderEdit();
    const priceInput = html.match(/<input[^>]*name="price"[^>]*>/)?.[0];
    expect(priceInput).toContain('disabled=""');
    expect(html).toContain("لا يمكن تغيير السعر لأن الوحدة محجوزة أو مباعة");
    expect(formInstance().getValues("price")).toBe(unit.price);
  });

  it("keeps the price editable for an AVAILABLE unit", () => {
    const priceInput = renderEdit().match(/<input[^>]*name="price"[^>]*>/)?.[0];
    expect(priceInput).toBeDefined();
    expect(priceInput).not.toContain('disabled=""');
  });

  it("shows loading without an editable form", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    const html = renderEdit();
    expect(html).toContain("جارٍ التحميل");
    expect(html).not.toContain("<form");
  });

  it("shows an error with a retry instead of an empty edit form", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    const html = renderEdit();
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("<form");
  });

  it("disables submit while a mutation is pending", () => {
    vi.mocked(useMutation).mockReturnValue({
      isPending: true,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useMutation>);
    expect(renderEdit().match(/<button[^>]*type="submit"[^>]*>/)?.[0]).toContain('disabled=""');
  });
});
