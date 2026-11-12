import "server-only";

import type { ErrorCode } from "./error-codes";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ErrorCode, fieldErrors?: Record<string, string[]>) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
