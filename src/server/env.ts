import "server-only";

import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "missing" })
    .trim()
    .min(1, "missing")
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "must start with postgresql:// or postgres://",
    ),
  APP_ORIGIN: z
    .string({ error: "missing" })
    .trim()
    .min(1, "missing")
    .refine((value) => {
      try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && url.origin === value;
      } catch {
        return false;
      }
    }, "must be an origin like https://example.com (no path)"),
  LOG_LEVEL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"], {
        error: "must be one of fatal, error, warn, info, debug, trace, silent",
      })
      .default("info"),
  ),
});

export type Env = Readonly<z.infer<typeof envSchema>>;

export class EnvError extends Error {
  constructor(failures: readonly { key: string; reason: string }[]) {
    super(
      [
        "Invalid environment configuration. The app will not start.",
        ...failures.map(({ key, reason }) => `  - ${key}: ${reason}`),
        "Set these variables (see .env.example) and start again.",
      ].join("\n"),
    );
    this.name = "EnvError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // One reason per key: an empty value would otherwise also fail the format check.
    const reasons = new Map<string, string>();
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      if (!reasons.has(key)) reasons.set(key, issue.message);
    }
    throw new EnvError([...reasons].map(([key, reason]) => ({ key, reason })));
  }
  return Object.freeze(result.data);
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}
