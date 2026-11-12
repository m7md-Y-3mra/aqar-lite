import "server-only";

import pino, { type DestinationStream } from "pino";

const options = {
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "token",
      "*.token",
      "cookie",
      "*.cookie",
      "authorization",
      "*.authorization",
      "headers.cookie",
      "headers.authorization",
      "*.headers.cookie",
      "*.headers.authorization",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[Redacted]",
  },
};

export const logger = pino(options);

export function createLogger(destination: DestinationStream) {
  return pino(options, destination);
}
