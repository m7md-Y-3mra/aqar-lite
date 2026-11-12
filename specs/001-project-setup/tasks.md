---

description: "Task list for Phase 0: Project Setup and Tooling"
---

# Tasks: Project Setup and Tooling

**Input**: Design documents from `specs/001-project-setup/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: This phase has no tenant data or money logic, so constitution principles I/III/IV need no tests yet. The spec requires these tests: the lint-rule test (FR-012), the env tests (FR-013/014), the sample unit and integration tests (FR-017/018), and the security-header and convention tests named in plan.md's "Requirement → proof map". In each story, write the tests before the code they prove.

**Organization**: Tasks are grouped by user story (spec.md US1–US5).

**Rules for every task**: follow AGENTS.md. Use kebab-case names. Every file in `src/server/` starts with `import "server-only";`. Don't use `console.log` in `src/`. Don't add packages beyond plan.md and research.md R4/R5. Commit after each working step with a small Conventional Commit ending in the attribution trailer.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, pinned dependencies, base tooling configuration.

- [X] T001 Create `package.json` (name `aqar-lite`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=22.12 <23" }`) with scripts `dev`=`next dev`, `build`=`next build`, `start`=`next start`, `lint`=`eslint .`, `typecheck`=`tsc --noEmit`, `test`=`vitest run --config vitest.config.ts`, `test:integration`=`vitest run --config vitest.integration.config.ts`, `db:migrate`=`prisma migrate dev`, `db:seed`=`prisma db seed`, `db:generate`=`prisma generate`, `format`=`prettier --write .`. Then install with **exact** versions (`npm i -E`). Runtime: `next@16.4.6 react@19.3.1 react-dom@19.3.1 prisma@7.10.1 @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 zod@4.6.7 @tanstack/react-query@5.107.1 sonner@2.0.8 react-hook-form@7.92.0 @hookform/resolvers@7.0.6 date-fns@4.4.0 @date-fns/tz@1.5.0 @node-rs/argon2@2.2.2 pino@10.4.0 server-only@0.0.1`. Dev: `typescript@6.0.3 @types/node@22 @types/react@19 @types/react-dom@19 eslint@9.39.5 eslint-config-next@16.4.6 @tanstack/eslint-plugin-query@5.107.1 prettier@3.10.1 vitest@5.1.0 tailwindcss@4.3.5 @tailwindcss/postcss@4.3.5`. `prisma` must be in `dependencies`, not devDependencies; the container runs `migrate deploy`. Writes `package.json`, `package-lock.json`.
- [ ] T002 [P] Create `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `noEmit: true`, `allowImportingTsExtensions: true`, `module: "esnext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"` (or what Next 16 writes), `incremental: true`, `plugins: [{ "name": "next" }]`, `paths: { "@/*": ["./src/*"] }`. Include `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `**/*.mts`, `.next/types/**/*.ts`. Exclude `node_modules`.
- [ ] T003 [P] Create `.gitignore` (`node_modules/`, `.next/`, `out/`, `coverage/`, `.env`, `.env.*` but `!.env.example`, `src/generated/`, `next-env.d.ts`, `*.tsbuildinfo`), `.nvmrc` (`22`), `.prettierrc.json` (`{ "printWidth": 100 }`), and `.prettierignore` (`.next`, `node_modules`, `src/generated`, `package-lock.json`, `specs`, `docs`).
- [ ] T004 [P] Create the empty-folder placeholders `src/features/.gitkeep` and `src/shared/components/ui/.gitkeep` (plan.md departure 2).
- [ ] T005 [P] Create `postcss.config.mjs` exporting `{ plugins: { "@tailwindcss/postcss": {} } }`.
- [ ] T006 Run `npx shadcn@4.23.0 init` (Tailwind v4, RTL enabled if the CLI offers it, CSS variables) and point `components.json` aliases at `@/shared/components`, `@/shared/components/ui`, `@/shared/lib`, `@/shared/lib/utils`, and its css at `src/app/globals.css`. Result: `components.json`, `src/shared/lib/utils.ts` (`cn()`), `src/app/globals.css` (`@import "tailwindcss";` plus theme tokens), and the shadcn base packages (`clsx tailwind-merge class-variance-authority lucide-react tw-animate-css`) pinned in `package.json`. Do **not** add any component and do **not** install `next-themes`. If the CLI writes elsewhere, move the files to these paths.
- [ ] T007 Create `eslint.config.mjs` (flat config) with only the base: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, `@tanstack/eslint-plugin-query` `flat/recommended`, `@typescript-eslint/no-explicit-any: "error"`, `no-console: "error"` for `src/**`, and global ignores `.next/**`, `node_modules/**`, `src/generated/**`, `next-env.d.ts`, `specs/**`. No type-aware rules, so the ESLint Node API can lint virtual files (needed by T038). The layer rules come in US3 (T036).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared server and client infrastructure that every story uses: env, database client, logger, errors, HTTP wrapper, query client, unit test runner.

**⚠️ CRITICAL**: No user story work starts until this phase is done.

- [ ] T008 Create `prisma/schema.prisma` with only `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }` and `datasource db { provider = "postgresql" }`, and no models. Create `prisma.config.ts`: `import { defineConfig, env } from "prisma/config"`. At the top, `if (existsSync(".env")) process.loadEnvFile(".env")` (Node built-in; Prisma 7 no longer loads `.env`). Export `defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations", seed: "node prisma/seed.ts" }, datasource: { url: env("DATABASE_URL") } })`.
- [ ] T009 [P] Create `prisma/seed.ts`: plain TypeScript runnable by Node 22 type stripping (no enums, no imports with `@/`). In phase 0 it only prints `"Seed: nothing to seed in this phase."` with `process.stdout.write`. Add a comment: phase 1 makes it idempotent ("skip if data exists").
- [ ] T010 Create `src/server/env.ts` per [contracts/environment.md](./contracts/environment.md). Contents: `import "server-only"`; a Zod schema for `DATABASE_URL` (trimmed, non-empty, must start with `postgresql://` or `postgres://`), `APP_ORIGIN` (trimmed, non-empty, `http(s)` URL whose `origin === value`, so no path), and `LOG_LEVEL` (enum `fatal|error|warn|info|debug|trace|silent`, default `info`, empty treated as unset). Export `class EnvError extends Error` whose message lists **every** failing key with a reason and never a value (the format in contracts/environment.md). Export `parseEnv(source: Record<string, string | undefined>): Env` (pure, throws `EnvError`), `getEnv(): Env` (lazy and cached; parses `process.env` on first call, never at import time), and `type Env` (readonly). Use only erasable TypeScript (no enums or namespaces) so `scripts/check-env.ts` can run it under Node type stripping.
- [ ] T011 [P] Create `.env.example` listing `DATABASE_URL=postgresql://aqar:aqar@localhost:5432/aqar`, `APP_ORIGIN=http://localhost:3000`, `LOG_LEVEL=info` (each with a one-line `#` comment), then a `# Tooling only (not read by the app)` block with `TEST_DATABASE_URL=postgresql://aqar:aqar@localhost:5432/aqar_test`. No real secrets.
- [ ] T012 [P] Create `src/server/logger.ts`: `import "server-only"`. Export `logger` = `pino({ level: process.env.LOG_LEVEL || "info", redact: { paths: [...], censor: "[Redacted]" } })`. Read `process.env` directly so importing the logger never triggers full env validation; an invalid `LOG_LEVEL` has already stopped startup through `getEnv()`. Redact paths: `password`, `*.password`, `passwordHash`, `*.passwordHash`, `token`, `*.token`, `cookie`, `*.cookie`, `authorization`, `*.authorization`, `headers.cookie`, `headers.authorization`, `*.headers.cookie`, `*.headers.authorization`, `req.headers.cookie`, `req.headers.authorization`. No transports. Also export `createLogger(destination)` for tests, built with the same options.
- [ ] T013 Create `src/server/db.ts`: `import "server-only"`. Build a singleton `PrismaClient` from `@/generated/prisma/client` with `adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL })`, created lazily on first `getDb()` and kept on `globalThis` in development to survive hot reload. Export `getDb()`, `type Tx` (the transaction client type from the generated client), and `withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>` that calls `getDb().$transaction(fn)`. Run `npm run db:generate` first (with `DATABASE_URL` set) so the import type-checks. Depends on T008 and T010.
- [ ] T014 [P] Create `src/server/http/error-codes.ts` (`import "server-only"`): `export const ERROR_CODES = { VALIDATION_ERROR: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, INVALID_ORIGIN: 403, NOT_FOUND: 404, INTERNAL_ERROR: 500 } as const` and `export type ErrorCode = keyof typeof ERROR_CODES`. Create `src/server/http/app-error.ts` (`import "server-only"`): `class AppError extends Error` with readonly `code: ErrorCode` and optional `fieldErrors?: Record<string, string[]>`.
- [ ] T015 [P] Create `src/shared/lib/error-messages.ts`: `import type { ErrorCode } from "@/server/http/error-codes"` (type-only, so no `server-only` at runtime). Export `ERROR_MESSAGES: Record<ErrorCode, string>` with Arabic text, e.g. `VALIDATION_ERROR: "البيانات المدخلة غير صحيحة"`, `UNAUTHORIZED: "يجب تسجيل الدخول أولاً"`, `FORBIDDEN: "ليست لديك صلاحية لهذا الإجراء"`, `INVALID_ORIGIN: "تم رفض الطلب"`, `NOT_FOUND: "العنصر غير موجود"`, `INTERNAL_ERROR: "حدث خطأ غير متوقع، حاول مرة أخرى"`.
- [ ] T016 Create `src/server/http/route-handler.ts` (`import "server-only"`) per [contracts/api-response.md](./contracts/api-response.md). Export `handleRoute<Ctx>({ auth: "public" | "user", handler: (req: Request, ctx: Ctx) => Promise<Response | { data: unknown; status?: number }> })` returning `(req, ctx) => Promise<Response>`. Steps: (1) POST/PUT/PATCH/DELETE with an `Origin` header that is missing or not equal to `getEnv().APP_ORIGIN` → 403 `INVALID_ORIGIN`; (2) `auth: "user"` → **always** 401 `UNAUTHORIZED` in phase 0 (fail closed), with a `// Phase 2: replace with requireUser()` comment; (3) run the handler and wrap a plain result as `Response.json({ data }, { status })`; (4) map errors: `AppError` → its status, `{ error: { code, message: ERROR_MESSAGES[code], fieldErrors? } }`; `ZodError` → 400 `VALIDATION_ERROR` with `fieldErrors` from `z.flattenError(err).fieldErrors`; `SyntaxError` from `req.json()` → 400 `VALIDATION_ERROR`; anything else → `logger.error({ err, method, path }, "Unhandled route error")` and 500 `INTERNAL_ERROR` with the generic Arabic message only. Depends on T010, T012, T014, T015.
- [ ] T017 [P] Create `src/shared/lib/query-client.ts`: `getQueryClient()` using `isServer` from `@tanstack/react-query`. On the server, return a new `QueryClient` per call. In the browser, return one lazily created singleton. Default options: `queries: { staleTime: 30_000 }`, `dehydrate: { shouldDehydrateQuery: (q) => defaultShouldDehydrateQuery(q) || q.state.status === "pending" }`.
- [ ] T018 [P] Create `src/shared/components/providers/providers.tsx` (`"use client"`): `Providers({ children })` wrapping children in `QueryClientProvider` with `getQueryClient()`, plus `<Toaster dir="rtl" position="top-center" richColors />` imported from `sonner` (not the shadcn wrapper). Create `src/shared/components/providers/index.ts` that re-exports only `Providers`.
- [ ] T019 Create `vitest.config.ts` (unit): `test.include: ["tests/unit/**/*.test.ts"]`, `environment: "node"`, `testTimeout: 30_000`, `resolve.alias: { "@": <abs path to src>, "server-only": <abs path to node_modules/server-only/empty.js> }`, and `test.env` with fake values for **every** required variable (`DATABASE_URL: "postgresql://unit:unit@localhost:5432/unit_unused"`, `APP_ORIGIN: "http://localhost:3000"`, `LOG_LEVEL: "silent"`). No database access.

**Checkpoint**: `npm run typecheck` passes (after `npm run db:generate`), and `npm run lint` passes on the base config.

---

## Phase 3: User Story 1 - One-command start on a clean machine (Priority: P1) 🎯 MVP

**Goal**: A fresh clone plus `docker compose up` starts PostgreSQL (with `aqar_test`), checks env, migrates, seeds, and serves a production build of an Arabic RTL home page with security headers.

**Independent Test**: [quickstart.md](./quickstart.md) §1–§3 on a clean clone with `docker compose down -v` first.

### Tests for User Story 1

- [ ] T020 [P] [US1] Write `tests/unit/next-config.test.ts`: import the default export of `next.config.ts` and call `headers()`. For source `/:path*`, assert these headers are present: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`, and a `Content-Security-Policy` containing `default-src 'self'`, `frame-ancestors 'none'` and `object-src 'none'`. Also assert `poweredByHeader === false`. It must fail until T021 exists.

### Implementation for User Story 1

- [ ] T021 [US1] Create `next.config.ts` per research.md R11. Set `poweredByHeader: false`, and add `async headers()` returning the five headers for `/:path*`. The CSP is `default-src 'self'; script-src 'self' 'unsafe-inline'<+ " 'unsafe-eval'" only when NODE_ENV === "development">; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. Do not import `src/server/env.ts` here (building must not need runtime env).
- [ ] T022 [US1] Create `src/app/layout.tsx`: `<html lang="ar" dir="rtl">`, with `IBM_Plex_Sans_Arabic` from `next/font/google` (subsets `["arabic"]`, weights 400/500/700, `display: "swap"`, CSS variable applied on `<html>`). Import `./globals.css`, wrap `<body>` children in `<Providers>` from `@/shared/components/providers`, and set `metadata` with an Arabic `title: "عقار لايت"` and a description.
- [ ] T023 [US1] Create `src/app/page.tsx`: a server component with no hooks, no data and no `requireUser()` (plan.md Complexity Tracking). It shows a centered `<main>` with the heading `عقار لايت` and one line `نظام بيع الوحدات العقارية بالتقسيط`. Use Tailwind logical classes only (`ps-`/`pe-`/`ms-`/`me-`, never `ml-`/`mr-`/`left-`/`right-`) and make it readable at 375 px and on desktop.
- [ ] T024 [P] [US1] Create `scripts/check-env.ts`: `import { getEnv, EnvError } from "../src/server/env.ts"`. Call `getEnv()`. On `EnvError`, write the message to stderr and `process.exit(1)`; on success, print `Environment OK` to stdout. It runs as `node --conditions=react-server scripts/check-env.ts` (the condition makes `server-only` resolve to its empty export, research.md R7).
- [ ] T025 [P] [US1] Create `docker/db/init/01-create-test-db.sql` containing `CREATE DATABASE aqar_test;`. Postgres runs it only on an empty data volume.
- [ ] T026 [P] [US1] Create `docker/app/entrypoint.sh` (`#!/bin/sh`, `set -eu`, executable bit set with `git update-index --chmod=+x`). Run in order: `node --conditions=react-server scripts/check-env.ts` → `npx prisma migrate deploy` → `npx prisma db seed` → `exec npx next start -H 0.0.0.0 -p 3000`.
- [ ] T027 [P] [US1] Create `.dockerignore`: `node_modules`, `.next`, `.git`, `.github`, `.env`, `.env.*`, `!.env.example`, `src/generated`, `specs`, `docs`, `tests`, `coverage`, `*.md`.
- [ ] T028 [US1] Create `Dockerfile` per research.md R8 and the plan.md section "Docker build: dummy database URL is build-time only":
  - `FROM node:22-bookworm-slim AS deps`: `WORKDIR /app`, copy `package.json package-lock.json`, `npm ci`.
  - `FROM node:22-bookworm-slim AS build`: copy `node_modules` from deps, then the source. Run `RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate`, the **only** place a database URL appears. **No `ENV DATABASE_URL`, no `ARG DATABASE_URL`.** Then `RUN npm run build` and `RUN npm prune --omit=dev`.
  - `FROM node:22-bookworm-slim AS runner`: `ENV NODE_ENV=production`, `WORKDIR /app`. Copy from build, owned by `node`: `package.json`, `node_modules`, `.next`, `next.config.ts`, `prisma`, `prisma.config.ts`, `scripts`, `src/server/env.ts` (keep the same relative path), `src/generated` (the generated client), and `docker/app/entrypoint.sh`. Then `USER node`, `EXPOSE 3000`, `ENTRYPOINT ["./docker/app/entrypoint.sh"]`.
  - Check: dev packages (including `typescript`) are pruned, but `next start` must still load `next.config.ts`. If T030 shows it cannot load the config without `typescript`, rename it to `next.config.mjs` (plain JS with a JSDoc `@type {import('next').NextConfig}`) and update T020's import. Do not move `typescript` into `dependencies`.
- [ ] T029 [US1] Create `docker-compose.yml`:
  - **`db` service**:
    - `image: postgres:18-alpine`
    - `environment: POSTGRES_USER=aqar, POSTGRES_PASSWORD=aqar, POSTGRES_DB=aqar`
    - `volumes`: named `db-data:/var/lib/postgresql` (**not** `/var/lib/postgresql/data`; plan.md "PostgreSQL 18 data volume") and `./docker/db/init:/docker-entrypoint-initdb.d:ro`
    - `ports: "5432:5432"`
    - `healthcheck: pg_isready -U aqar -d aqar`, interval 5s, timeout 5s, retries 10
  - **`app` service**:
    - `build: .`
    - `depends_on: db: condition: service_healthy`
    - `environment: DATABASE_URL=postgresql://aqar:aqar@db:5432/aqar, APP_ORIGIN=http://localhost:3000, LOG_LEVEL=info`, with a comment that these are local development values, not secrets
    - `ports: "3000:3000"`
  - Top-level `volumes: db-data:`.
- [ ] T030 [US1] Validate US1 with quickstart.md §1–§3 on a clean state (`docker compose down -v && docker compose up --build`):
  - `curl` shows `lang="ar" dir="rtl"` and the security headers, with no `x-powered-by`.
  - `docker image inspect` shows no `DATABASE_URL` in `Config.Env`.
  - `PGDATA` is `/var/lib/postgresql/18/docker`.
  - The second `docker compose up` has no errors.
  - Fix anything that fails before moving on. Write down the measured time from clone to the page being ready (SC-001).

**Checkpoint**: The stack starts with one command and serves the Arabic RTL page.

---

## Phase 4: User Story 2 - Quality gates ready before feature code (Priority: P1)

**Goal**: `lint`, `typecheck`, `test` and `test:integration` all run and pass, with real sample tests. Integration tests use the separate, auto-migrated `aqar_test` database.

**Independent Test**: [quickstart.md](./quickstart.md) §6. All four pass with the DB up; `test` still passes with the DB stopped; `test:integration` fails with a clear message when the DB is down.

### Tests for User Story 2

- [ ] T031 [P] [US2] Write `tests/unit/server/http/route-handler.test.ts`. Set the `APP_ORIGIN` env, then build handlers with `handleRoute` and call them with `new Request(...)`. Assert:
  - (a) POST with no `Origin` → 403 `INVALID_ORIGIN`.
  - (b) POST with `Origin: https://evil.example` → 403.
  - (c) POST with the matching origin → 200 `{ data }`.
  - (d) GET with no `Origin` → 200.
  - (e) `auth: "user"` → 401 `UNAUTHORIZED`.
  - (f) a handler throwing `new AppError("NOT_FOUND")` → 404 with `error.code`, and `error.message` equal to `ERROR_MESSAGES.NOT_FOUND`.
  - (g) a handler parsing `{}` with `z.object({ name: z.string() })` → 400 with `error.fieldErrors.name`.
  - (h) a malformed JSON body → 400 `VALIDATION_ERROR`.
  - (i) a handler throwing `new Error("db password=secret")` → 500, generic Arabic message, the body does not contain `secret`, and the error is passed to the logger (spy on `logger.error`).
- [ ] T032 [P] [US2] Write `tests/unit/server/logger.test.ts`: create a logger with `createLogger` writing to an in-memory stream. Log `{ password: "p", user: { passwordHash: "h" }, token: "t", headers: { cookie: "c", authorization: "a" } }` and assert the JSON line contains `[Redacted]` for each value and none of `"p"`, `"h"`, `"t"`, `"c"`, `"a"` as values.
- [ ] T033 [P] [US2] Write `tests/unit/shared/lib/error-messages.test.ts`: assert every key of `ERROR_CODES` has a non-empty message in `ERROR_MESSAGES` that contains Arabic characters (`/[؀-ۿ]/`), and that `ERROR_MESSAGES` has no extra keys.

### Implementation for User Story 2

- [ ] T034 [US2] Create `vitest.integration.config.ts`:
  - `test.include: ["tests/integration/**/*.test.ts"]`, `environment: "node"`, `fileParallelism: false`, `testTimeout: 30_000`, the same `@` and `server-only` aliases as T019, `globalSetup: ["tests/integration/setup/global-setup.ts"]`.
  - `const testDbUrl = process.env.TEST_DATABASE_URL ?? "postgresql://aqar:aqar@localhost:5432/aqar_test"`.
  - `test.env: { DATABASE_URL: testDbUrl, APP_ORIGIN: "http://localhost:3000", LOG_LEVEL: "silent" }`. The test workers never see the developer's app `DATABASE_URL`.
- [ ] T035 [US2] Create `tests/integration/setup/global-setup.ts` (default export `async function setup()`). Resolve the same `testDbUrl`, then:
  - (1) Parse the URL. If the database name does not end in `_test`, throw `Refusing to run integration tests against "<name>": the database name must end in _test.`
  - (2) Check the connection with `pg` (`new pg.Client({ connectionString, connectionTimeoutMillis: 3000 })`, `connect()`, `end()`). On failure, throw `Test database not reachable at <host>:<port>/<db>. Run \`docker compose up -d db\` first.` without the password.
  - (3) Run `execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: testDbUrl }, stdio: "inherit" })`.

  This file is allowed to use the DB driver directly; the lint override comes in T040.
- [ ] T036 [US2] Write `tests/integration/server/db.test.ts`: import `withTransaction` from `@/server/db`. Run `tx.$queryRaw\`SELECT current_database() AS db\`` inside it and assert `db === "aqar_test"`. Add a second case: `withTransaction(async (tx) => { await tx.$queryRaw\`SELECT 1\`; throw new Error("rollback") })` rejects with `rollback`. Disconnect in `afterAll` via `getDb().$disconnect()`.
- [ ] T037 [US2] Validate US2 with quickstart.md §6 (copy `.env.example` → `.env`, `npm run db:generate`, lint, typecheck, test, `docker compose up -d db`, `test:integration`). Then stop the DB, confirm `npm run test` still passes, and confirm `npm run test:integration` fails with the "not reachable" message.

**Checkpoint**: All four quality commands pass.

---

## Phase 5: User Story 3 - Layer rules enforced by tooling (Priority: P2)

**Goal**: Lint fails on ORM imports outside repositories and the DB module, and on server imports in client code. A test proves it, and the build fails on `server-only` too.

**Independent Test**: `npm run test` runs the rule tests; [quickstart.md](./quickstart.md) §5 by hand.

### Tests for User Story 3

- [ ] T038 [P] [US3] Write `tests/unit/architecture/import-rules.test.ts` using `new ESLint({ cwd: <repo root> })` and `lintText(code, { filePath })` with virtual paths. Each case asserts whether there is a `no-restricted-imports` error. **Errors**:
  - (1) `src/features/demo/server/demo.service.ts` importing `@prisma/client`
  - (2) same file importing `@/generated/prisma/client`
  - (3) same file importing `../../../generated/prisma/client`
  - (4) `src/server/http/route-handler.ts` importing `@/generated/prisma/client`
  - (5) `src/features/demo/client/demo-form/demo-form.tsx` importing `@/server/db`
  - (6) same client file importing `@/generated/prisma/client` (proves the ORM ban is not dropped in the client block)
  - (7) `src/shared/components/x/x.tsx` importing `@/features/demo/server/demo.service`

  **No error**:
  - (8) `src/features/demo/server/demo.repository.ts` importing `@/generated/prisma/client`
  - (9) `src/server/db.ts` importing `@/generated/prisma/client` and `@prisma/adapter-pg`
  - (10) `src/shared/lib/error-messages.ts` with `import type { ErrorCode } from "@/server/http/error-codes"`
  - (11) `prisma/seed.ts` importing the generated client
  - (12) `tests/integration/setup/global-setup.ts` importing `pg`

  It must fail until T040 exists.
- [ ] T039 [P] [US3] Write `tests/unit/architecture/conventions.test.ts`. It walks the file system with `node:fs`, skipping `src/generated` and `.gitkeep`, and asserts:
  - (a) every `.ts`/`.tsx` file under `src/server/` and `src/features/*/server/` has `import "server-only";` as its first statement;
  - (b) every file and folder name under `src/` and `tests/` matches `^[a-z0-9]+(?:[-.][a-z0-9]+)*$` (kebab-case, dots allowed for `.test.ts`, `.repository.ts`, …). Next.js route-segment folders are also accepted when their inner name is kebab-case: dynamic `[id]`, catch-all `[...slug]`, optional catch-all `[[...slug]]` and route groups `(auth)`. Next.js file names (`layout.tsx`, `page.tsx`, `route.ts`, `globals.css`, `instrumentation.ts`) already match. Include a self-check case that `[id]` and `(auth)` pass and `UnitList` and `unit_list` fail.

### Implementation for User Story 3

- [ ] T040 [US3] Extend `eslint.config.mjs` with the layer rules from research.md R6.
  - Define constants:
    - `ORM_PATTERNS` = `[{ group: ["@prisma/*", "@/generated/*", "**/generated/prisma", "**/generated/prisma/*"], message: "Only *.repository.ts files and src/server/db.ts may import the ORM." }]`, plus the paths `pg`.
    - `SERVER_PATTERNS` = `[{ group: ["@/server/*", "@/features/*/server/*", "**/server/*", "server-only"], allowTypeImports: true, message: "Client code must not import server code." }]`.
  - Add the config objects in this order:
    - (a) `files: ["src/**/*.{ts,tsx}"]` → `no-restricted-imports: ["error", { patterns: ORM_PATTERNS }]`.
    - (b) `files: ["src/features/*/client/**", "src/shared/**"]` → `no-restricted-imports: ["error", { patterns: [...ORM_PATTERNS, ...SERVER_PATTERNS] }]`. Both lists are repeated on purpose: flat config replaces the options, it does not merge them.
    - (c) `files: ["src/**/*.repository.ts", "src/server/db.ts", "prisma/**", "scripts/**", "tests/integration/setup/**"]` → `no-restricted-imports: "off"`.
  - Make T038 pass.
- [ ] T041 [US3] Validate US3 with quickstart.md §5: add a temporary rule-breaking service file, see `npm run lint` fail with the file name, and delete it. Add a temporary `"use client"` component importing `@/server/db`, then run `npx next build` with lint skipped: confirm the build fails on `server-only`, and delete the component. `npm run lint && npm run test` pass afterwards.

**Checkpoint**: Breaking a layer rule fails lint, and a test proves it.

---

## Phase 6: User Story 4 - Refuse to start with missing configuration (Priority: P2)

**Goal**: The app never starts with a missing, empty or invalid setting. It prints every failing variable by name, never a value.

**Independent Test**: [quickstart.md](./quickstart.md) §4, plus the automated tests below.

### Tests for User Story 4

- [ ] T042 [P] [US4] Write `tests/unit/server/env.test.ts`, testing `parseEnv` directly. Cases:
  - (a) a valid source returns typed values, and `LOG_LEVEL` defaults to `info`.
  - (b) `DATABASE_URL` missing → `EnvError` whose message contains `DATABASE_URL`.
  - (c) `APP_ORIGIN: "   "` (whitespace) → error naming `APP_ORIGIN`.
  - (d) `APP_ORIGIN: "http://x.com/path"` → error naming `APP_ORIGIN`.
  - (e) `DATABASE_URL: "mysql://..."` → error.
  - (f) both missing → one error naming **both**.
  - (g) source `DATABASE_URL: "postgresql://u:SuperSecret123@h/db"` with `APP_ORIGIN` missing → the message does **not** contain `SuperSecret123`.
  - (h) the set of keys in the env schema equals the set of non-tooling keys in `.env.example`: parse the file and ignore keys under the `# Tooling only` comment.
- [ ] T043 [P] [US4] Write `tests/unit/scripts/check-env.test.ts`. Spawn `process.execPath` with `["--conditions=react-server", "scripts/check-env.ts"]` via `spawnSync`, using an env with `PATH` only plus chosen variables. Cases:
  - (a) all valid → exit 0, stdout contains `Environment OK`;
  - (b) `APP_ORIGIN` absent → exit 1, stderr contains `APP_ORIGIN`;
  - (c) `DATABASE_URL` empty and `APP_ORIGIN` absent → exit 1, stderr names both, and the other secret value never appears.

### Implementation for User Story 4

- [ ] T044 [US4] Create `src/instrumentation.ts`. Export `async function register()`. When `process.env.NEXT_RUNTIME === "nodejs"`, `const { getEnv, EnvError } = await import("@/server/env")`, then call `getEnv()` inside `try`. On `EnvError`, write the message to stderr and `process.exit(1)`; rethrow anything else. This covers `next start` / `npm run dev` without the entrypoint.
- [ ] T045 [US4] Validate US4. Run `npm run test` (T042 and T043 green). Check the container with `docker compose run --rm -e APP_ORIGIN= app`: exit code 1, the message names `APP_ORIGIN`, and Next never starts. Check `next start` directly: `npm run build && env -u APP_ORIGIN npm start` exits with the same message.

**Checkpoint**: A missing setting stops startup with a clear message, proved by tests and in the container.

---

## Phase 7: User Story 5 - Automatic checks on every pull request (Priority: P3)

**Goal**: Every PR to `main` runs lint and typecheck and shows pass or fail. It is **not** a required check (user decision).

**Independent Test**: [quickstart.md](./quickstart.md) §7 after the repository is pushed.

- [ ] T046 [US5] Create `.github/workflows/ci.yml` per research.md R12:
  - Top level: `name: CI`, `on: pull_request: branches: [main]` (no `push` trigger), `permissions: contents: read`, `concurrency: { group: ci-${{ github.event.pull_request.number }}, cancel-in-progress: true }`.
  - Job `lint-typecheck`: `runs-on: ubuntu-latest`, `timeout-minutes: 10`. Steps:
    1. `actions/checkout@v7`
    2. `actions/setup-node@v7` with `node-version: 22`, `cache: npm`
    3. `npm ci`
    4. a step named `Generate Prisma client` with `if: hashFiles('prisma/schema.prisma') != ''`, `run: npx prisma generate`, and step-level `env: DATABASE_URL: postgresql://ci:ci@localhost:5432/ci`, with a comment that it is a dummy value only for generate
    5. `npm run lint`
    6. `npm run typecheck`
  - No secrets, only official `actions/*`.
- [ ] T047 [US5] Before committing the workflow, run the same commands locally on a clean install: `rm -rf node_modules src/generated && npm ci && DATABASE_URL=postgresql://ci:ci@localhost:5432/ci npx prisma generate && npm run lint && npm run typecheck`. All must pass. Do **not** create rulesets or change GitHub settings. Remote validation (quickstart.md §7) waits until the user pushes.

**Checkpoint**: The workflow file is committed and its commands pass locally.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T048 [P] Create `README.md`.
  - **Running**: needs Git and Docker only; `docker compose up`; app on `http://localhost:3000` (use `localhost`, not `127.0.0.1`, because of `APP_ORIGIN`); DB on 5432; run `docker compose down -v` once if an old volume exists (the test DB is created only on a fresh volume).
  - **Development**: `npm ci`, `cp .env.example .env`, `npm run db:generate`, then the npm scripts table from contracts/commands.md.
  - **Tests**: `docker compose up -d db` then `npm run test:integration`.
  - **Technical decisions**: the research.md R1–R3 pins with their reasons; Prisma 7 + adapter-pg; production build in Docker; lazy env.
  - **Assumptions**: the spec.md Assumptions plus clarifications Q1/Q2, and that CI is not a required check.
  - **Security**: the known limit that CSP allows inline scripts (no nonce, no proxy).
  - **Not done** and **AI tools**: section stubs, each with one line of real content for phase 0.
- [ ] T049 Run `npm audit --audit-level=high`. It must report no high or critical findings. If a fix needs a version change outside the pins, stop and ask the user.
- [ ] T050 Run `npx prettier --check .` and fix formatting with `npm run format` (no logic changes).
- [ ] T051 Final gate on a clean clone of the branch into a temp folder: `docker compose down -v`, then the full quickstart.md §1–§6, then `npm run lint && npm run typecheck && npm run test && npm run test:integration`. Record the results in the phase notes. Do not mark the phase done if any step fails.
- [ ] T052 Run `/security-review` on the branch diff (constitution, Development Workflow: a phase is done only when it shows no open issues). Fix every finding, or record it with a reason in the README "Security" section if it is out of scope for phase 0. Re-run `npm run lint && npm run typecheck && npm run test` after any fix.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 first; T002–T005 in parallel after T001; T006 after T005; T007 after T001.
- **Foundational (Phase 2)**: needs Setup. It blocks every story.
- **US1 (Phase 3)**: needs Foundational.
- **US2 (Phase 4)**: needs Foundational. T034–T037 need the `db` service from US1's T025/T029, so do US1 first.
- **US3 (Phase 5)**: needs Foundational. The lint test uses virtual file paths, so it does not need T034/T035 to exist. It edits `eslint.config.mjs`, so it runs after T007.
- **US4 (Phase 6)**: needs Foundational (`env.ts`). T045's container check needs US1.
- **US5 (Phase 7)**: needs a passing lint and typecheck, so run it after US3.
- **Polish (Phase 8)**: needs all stories. T052 (security review) runs last, after T051.

### Within Each Story

- Tests first; they fail, then the implementation makes them pass.
- Commit after each green step (for example `feat: add env validation`, `test: add import rule tests`, `ci: add lint and typecheck workflow`).

### Parallel Opportunities

- Setup: T002, T003, T004, T005.
- Foundational: T009, T011, T012, T014, T015, T017, T018 in parallel after T008 and T010; T013 and T016 after their inputs.
- US1: T020, T024, T025, T026, T027 in parallel; then T021–T023 and T028–T029.
- US2: T031, T032, T033 in parallel.
- US3: T038, T039 in parallel.
- US4: T042, T043 in parallel.

---

## Parallel Example: User Story 1

```bash
Task: "Write tests/unit/next-config.test.ts"
Task: "Create scripts/check-env.ts"
Task: "Create docker/db/init/01-create-test-db.sql"
Task: "Create docker/app/entrypoint.sh"
Task: "Create .dockerignore"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1) → **STOP and validate** quickstart §1–§3. The project now runs from a clean clone (the brief's "evaluation stops" gate).

### Incremental Delivery

US1 → US2 (gates) → US3 (layer rules) → US4 (env refusal) → US5 (CI) → Polish. Every step keeps `docker compose up` working and all gates green.

---

## Notes

- `[P]` = different files, no dependency on an unfinished task.
- Never edit an applied migration (none exist in this phase).
- Do not create `src/server/auth/`, `src/server/audit.ts` or `src/shared/lib/money.ts` in this phase; later phases add them.
- Phase done = `npm run lint && npm run typecheck && npm run test` plus `npm run test:integration` pass, and T052 (`/security-review`) shows no open issues.
