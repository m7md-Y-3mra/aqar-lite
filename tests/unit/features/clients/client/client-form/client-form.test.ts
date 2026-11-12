import { useMutation, useQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm, type UseFormReturn } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientForm } from "@/features/clients/client/client-form";
import { clientKeys } from "@/features/clients/clients.keys";
import { clientInputSchema } from "@/features/clients/clients.schemas";
import type { ClientDto, ClientInput } from "@/features/clients/clients.types";
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

const client: ClientDto = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "عميل الاختبار",
  phone: "0500000000",
  notes: "ملاحظة",
  salesRep: { id: "rep", name: "مندوب الاختبار" },
};

function renderEdit() {
  return renderToStaticMarkup(createElement(ClientForm, { mode: "edit", id: client.id }));
}

function formInstance() {
  return vi.mocked(useForm).mock.results.at(-1)!.value as UseFormReturn<ClientInput>;
}

function mutationOptions() {
  return vi.mocked(useMutation).mock.calls.at(-1)![0] as unknown as {
    mutationFn: (input: ClientInput) => Promise<ClientDto>;
    onSuccess: (data: ClientDto) => Promise<void>;
    onError: (error: Error) => Promise<void>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue(client);
  actions.refetch.mockResolvedValue({ data: client });
  vi.mocked(useQuery).mockReturnValue({
    data: client,
    isPending: false,
    isError: false,
    refetch: actions.refetch,
  } as unknown as ReturnType<typeof useQuery>);
  vi.mocked(useMutation).mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useMutation>);
});

describe("ClientForm", () => {
  it.each(["create", "edit"] as const)(
    "sends the parsed input using the %s endpoint",
    async (mode) => {
      renderToStaticMarkup(
        createElement(ClientForm, mode === "edit" ? { mode, id: client.id } : { mode }),
      );
      const input = clientInputSchema.parse(client);
      await mutationOptions().mutationFn(input);
      expect(apiFetch).toHaveBeenCalledWith(
        mode === "edit" ? `/api/clients/${client.id}` : "/api/clients",
        { method: mode === "edit" ? "PATCH" : "POST", body: JSON.stringify(input) },
      );
    },
  );

  it.each(["create", "edit"] as const)(
    "invalidates clients and navigates after %s success",
    async (mode) => {
      renderToStaticMarkup(
        createElement(ClientForm, mode === "edit" ? { mode, id: client.id } : { mode }),
      );
      await mutationOptions().onSuccess(client);
      expect(actions.invalidateQueries).toHaveBeenCalledWith({ queryKey: clientKeys.all });
      expect(actions.success).toHaveBeenCalledWith(
        mode === "edit" ? "تم حفظ التعديلات" : "تمت إضافة العميل",
      );
      expect(actions.push).toHaveBeenCalledWith(`/clients/${client.id}`);
    },
  );

  it("maps validation errors to the phone field", async () => {
    renderEdit();
    await mutationOptions().onError(
      new ApiError(400, "VALIDATION_ERROR", "هاتف غير صحيح", { phone: ["هاتف غير صحيح"] }),
    );
    expect(formInstance().getFieldState("phone").error?.message).toBe("هاتف غير صحيح");
  });

  it("keeps conflicts at the top of the form", async () => {
    renderEdit();
    const setError = vi.spyOn(formInstance(), "setError");
    await mutationOptions().onError(new ApiError(409, "CONFLICT", "تعارض"));
    expect(setError).toHaveBeenCalledWith("root", expect.objectContaining({ message: "تعارض" }));
  });

  it("renders fields and parsed edit defaults", () => {
    const html = renderEdit();
    for (const field of ["name", "phone", "notes"]) expect(html).toContain(`name="${field}"`);
    expect(html).toContain("<textarea");
    expect(html).toContain('dir="ltr"');
    expect(formInstance().getValues()).toEqual(clientInputSchema.parse(client));
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
