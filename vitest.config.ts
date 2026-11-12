import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    env: {
      DATABASE_URL: "postgresql://unit:unit@localhost:5432/unit_unused",
      APP_ORIGIN: "http://localhost:3000,http://127.0.0.1:3000",
      LOG_LEVEL: "silent",
    },
  },
});
