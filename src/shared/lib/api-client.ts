import { ERROR_MESSAGES } from "@/shared/lib/error-messages";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiBody<T> = {
  data?: T;
  error?: { code: string; message: string; fieldErrors?: Record<string, string[]> };
};

/** Calls one of our API routes: returns `data`, or throws ApiError from `{ error }`. */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  let body: ApiBody<T>;
  try {
    body = (await response.json()) as ApiBody<T>;
  } catch {
    throw new ApiError(response.status, "INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
  }

  if (!response.ok || body.error) {
    const error = body.error;
    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? ERROR_MESSAGES.INTERNAL_ERROR,
      error?.fieldErrors,
    );
  }
  return body.data as T;
}
