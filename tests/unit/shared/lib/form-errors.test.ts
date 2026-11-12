import type { UseFormSetError } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/lib/api-client";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";
import { applyApiError } from "@/shared/lib/form-errors";

describe("applyApiError", () => {
  it("maps 400 fieldErrors to each field", () => {
    type ClientFields = { name: string; phone: string };
    const setError = vi.fn<UseFormSetError<ClientFields>>();

    applyApiError<ClientFields>(
      new ApiError(400, "VALIDATION_ERROR", "بيانات غير صحيحة", {
        name: ["الاسم مطلوب", "الاسم قصير"],
        phone: ["رقم الهاتف غير صحيح"],
      }),
      setError,
    );

    expect(setError.mock.calls).toEqual([
      ["name", { type: "server", message: "الاسم مطلوب" }],
      ["phone", { type: "server", message: "رقم الهاتف غير صحيح" }],
    ]);
  });

  it("maps 409 to root", () => {
    const setError = vi.fn();
    applyApiError(new ApiError(409, "UNIT_CHANGED", "تم تعديل الوحدة"), setError);
    expect(setError).toHaveBeenCalledExactlyOnceWith("root", {
      type: "server",
      message: "تم تعديل الوحدة",
    });
  });

  it("does not map conflict fieldErrors to fields", () => {
    const setError = vi.fn();
    applyApiError(
      new ApiError(409, "UNIT_CHANGED", "تم تعديل الوحدة", { price: ["تغير السعر"] }),
      setError,
    );
    expect(setError).toHaveBeenCalledExactlyOnceWith("root", {
      type: "server",
      message: "تم تعديل الوحدة",
    });
  });

  it("maps a non-ApiError to root with the generic message", () => {
    const setError = vi.fn();
    applyApiError(new Error("Internal network details"), setError);
    expect(setError).toHaveBeenCalledExactlyOnceWith("root", {
      type: "server",
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  });

  it("maps a 400 without field messages to root", () => {
    const setError = vi.fn();
    applyApiError(
      new ApiError(400, "VALIDATION_ERROR", "بيانات غير صحيحة", { name: [] }),
      setError,
    );
    expect(setError).toHaveBeenCalledExactlyOnceWith("root", {
      type: "server",
      message: "بيانات غير صحيحة",
    });
  });
});
