import "server-only";

export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_ORIGIN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
