import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import query from "@tanstack/eslint-plugin-query";

// Flat config replaces a rule's options instead of merging them, so every block
// that restricts imports lists all the patterns it needs.
const ORM_PATTERNS = [
  {
    group: ["@prisma/*", "@/generated/**", "**/generated/prisma", "**/generated/prisma/**"],
    message: "Only *.repository.ts files and src/server/db.ts may import the ORM.",
  },
  { group: ["pg", "pg/*"], message: "Only src/server/db.ts may talk to the database driver." },
];

const SERVER_PATTERNS = [
  {
    group: ["@/server/**", "@/features/*/server/**", "**/server/**", "server-only"],
    allowTypeImports: true,
    message: "Client and shared code must not import server code.",
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  ...query.configs["flat/recommended"],
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
  { files: ["src/**/*.{ts,tsx}"], rules: { "no-console": "error" } },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": ["error", { patterns: ORM_PATTERNS }],
    },
  },
  {
    files: ["src/features/*/client/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [...ORM_PATTERNS, ...SERVER_PATTERNS] },
      ],
    },
  },
  {
    files: [
      "src/**/*.repository.ts",
      "src/server/db.ts",
      "prisma/**",
      "scripts/**",
      "tests/integration/setup/**",
    ],
    rules: { "@typescript-eslint/no-restricted-imports": "off" },
  },
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
