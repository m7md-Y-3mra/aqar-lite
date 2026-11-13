import "server-only";

import type { ErrorCode } from "./error-codes";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  /** Arabic text for the user that replaces the code's default message (e.g. one that names an amount). */
  readonly userMessage?: string;

  constructor(code: ErrorCode, fieldErrors?: Record<string, string[]>, userMessage?: string) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.userMessage = userMessage;
  }
}
