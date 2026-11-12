import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import query from "@tanstack/eslint-plugin-query";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  ...query.configs["flat/recommended"],
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
  { files: ["src/**/*.{ts,tsx}"], rules: { "no-console": "error" } },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "src/generated/**",
    "next-env.d.ts",
    "specs/**",
    ".claude/**",
    ".agents/**",
    ".specify/**",
    "docs/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "**/*.min.js",
  ]),
]);
