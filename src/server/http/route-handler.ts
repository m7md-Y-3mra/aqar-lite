import "server-only";

import { z, ZodError } from "zod";

import { getRequestUser } from "@/server/auth/request-user";
import type { SessionUser } from "@/server/auth/session.service";
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

/** Reads a JSON body. A body that is not valid JSON is the client's fault (400), not a server error. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION_ERROR");
  }
}

type RouteResult = Response | { data: unknown; status?: number };
type MaybePromise<T> = T | Promise<T>;
type Route<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

type PublicRouteOptions<Ctx> = {
  auth: "public";
  handler: (req: Request, ctx: Ctx) => MaybePromise<RouteResult>;
};

type UserRouteOptions<Ctx> = {
  auth: "user";
  handler: (req: Request, ctx: Ctx, user: SessionUser) => MaybePromise<RouteResult>;
};

export function handleRoute<Ctx = unknown>(options: PublicRouteOptions<Ctx>): Route<Ctx>;
export function handleRoute<Ctx = unknown>(options: UserRouteOptions<Ctx>): Route<Ctx>;
export function handleRoute<Ctx = unknown>(
  options: PublicRouteOptions<Ctx> | UserRouteOptions<Ctx>,
): Route<Ctx> {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const origin = req.headers.get("Origin");
      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
        (origin === null || !getEnv().APP_ORIGIN.includes(origin))
      ) {
        throw new AppError("INVALID_ORIGIN");
      }

      let result: RouteResult;
      if (options.auth === "user") {
        const user = await getRequestUser(req);
        if (user === null) throw new AppError("UNAUTHORIZED");
        result = await options.handler(req, ctx, user);
      } else {
        result = await options.handler(req, ctx);
      }

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
      logger.error(
        { err, method: req.method, path: new URL(req.url).pathname },
        "Unhandled route error",
      );
      return errorResponse("INTERNAL_ERROR");
    }
  };
}
