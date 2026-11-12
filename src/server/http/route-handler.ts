import "server-only";

import { z, ZodError } from "zod";

import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";
import { AppError } from "./app-error";
import { ERROR_CODES, type ErrorCode } from "./error-codes";

function errorResponse(code: ErrorCode, fieldErrors?: Record<string, string[]>) {
  return Response.json(
    {
      error: {
        code,
        message: ERROR_MESSAGES[code],
        ...(code === "VALIDATION_ERROR" && fieldErrors ? { fieldErrors } : {}),
      },
    },
    { status: ERROR_CODES[code] },
  );
}

export function handleRoute<Ctx = unknown>({
  auth,
  handler,
}: {
  auth: "public" | "user";
  handler: (req: Request, ctx: Ctx) => Promise<Response | { data: unknown; status?: number }>;
}) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
        req.headers.get("Origin") !== getEnv().APP_ORIGIN
      ) {
        throw new AppError("INVALID_ORIGIN");
      }

      if (auth === "user") {
        // Phase 2: replace with requireUser()
        throw new AppError("UNAUTHORIZED");
      }

      const result = await handler(req, ctx);
      return result instanceof Response
        ? result
        : Response.json({ data: result.data }, { status: result.status ?? 200 });
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.fieldErrors);
      }
      if (err instanceof ZodError) {
        return errorResponse("VALIDATION_ERROR", z.flattenError(err).fieldErrors);
      }
      if (err instanceof SyntaxError) {
        return errorResponse("VALIDATION_ERROR");
      }
      logger.error(
        { err, method: req.method, path: new URL(req.url).pathname },
        "Unhandled route error",
      );
      return errorResponse("INTERNAL_ERROR");
    }
  };
}
