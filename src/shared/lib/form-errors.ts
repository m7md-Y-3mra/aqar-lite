import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/shared/lib/api-client";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";

/** 400 field errors go next to each field; anything else goes to the top of the form. */
export function applyApiError<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (err instanceof ApiError && err.status === 400 && err.fieldErrors) {
    let mapped = false;
    for (const [field, messages] of Object.entries(err.fieldErrors)) {
      const message = messages[0];
      if (message === undefined) continue;
      setError(field as Path<T>, { type: "server", message });
      mapped = true;
    }
    if (mapped) return;
  }

  const message = err instanceof ApiError ? err.message : ERROR_MESSAGES.INTERNAL_ERROR;
  setError("root", { type: "server", message });
}
