import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests never see the developer's app DATABASE_URL: they always run on the test database.
const testDbUrl = process.env.TEST_DATABASE_URL ?? "postgresql://aqar:aqar@localhost:5433/aqar_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    globalSetup: ["tests/integration/setup/global-setup.ts"],
    env: {
      DATABASE_URL: testDbUrl,
      APP_ORIGIN: "http://localhost:3000",
      LOG_LEVEL: "silent",
    },
  },
});
