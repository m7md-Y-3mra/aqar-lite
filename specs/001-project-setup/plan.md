# Implementation Plan: Project Setup and Tooling

**Branch**: `001-project-setup` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-project-setup/spec.md`

## Summary

Create the empty Aqar Lite project so later phases only add features. A clean clone plus
`docker compose up` starts PostgreSQL (with a second `aqar_test` database), checks the environment,
applies migrations (none yet), runs the (empty) seed, and serves a production build of an Arabic RTL
home page. The repository gets the AGENTS.md folder layout, the shared server infrastructure (db, env,
logger, HTTP wrapper and errors), two Vitest setups (unit with no DB; integration on a real test DB that
auto-migrates), ESLint rules that block ORM and server imports where they do not belong (proved by a
test), and a GitHub Actions check that runs lint and typecheck on every pull request to `main`.
Details and evidence are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict), Node.js 22 LTS

**Primary Dependencies**: Next.js 16.4.6 (App Router), React 19.3, Prisma 7.10.1 + `@prisma/adapter-pg`,
Zod 4.6, TanStack Query 5.107, Tailwind 4.3 + shadcn/ui, sonner 2, pino 10, react-hook-form 7.92,
date-fns 4 + @date-fns/tz, @node-rs/argon2 2.2, server-only. Versions are pinned in research.md R1–R4.

**Storage**: PostgreSQL 18 (`postgres:18-alpine`): app database `aqar` and test database `aqar_test` in one container. No tables in this phase.

**Testing**: Vitest 5.1, two configs (unit / integration). ESLint Node API for the lint-rule test.

**Target Platform**: Linux containers (Docker Compose); CI on GitHub Actions `ubuntu-latest`.

**Project Type**: Web application (one Next.js app; frontend and backend in the same project).

**Performance Goals**: Clean clone to working home page in under 5 minutes (SC-001); PR check result within 10 minutes (SC-006).

**Constraints**: Production build in Docker (clarification Q1); building the image needs no runtime secrets;
`npm audit` with no high or critical findings; no package outside the agreed list plus the approved research.md R5 additions.

**Scale/Scope**: Infrastructure only: one placeholder page, no business features (FR-022).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Source: `.specify/memory/constitution.md`.

| # | Principle | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| I | Tenant Isolation (NON-NEGOTIABLE) | PASS (nothing to isolate yet) | No tenant data in this phase. The structure is ready: repositories are the only ORM users (enforced by lint), so phase 1+ `companyId` filters have one place to live. |
| II | Server-Side Authorization | PASS | The route wrapper has an `auth` option. Until phase 2 adds sessions, `auth: "user"` **fails closed** (401). Zod errors map to 400 `fieldErrors`. |
| III | Financial Accuracy | PASS (not applicable yet) | No money code. `date-fns` + `@date-fns/tz` installed for phase 4–6. |
| IV | Atomic and Concurrency-Safe Operations | PASS | `withTransaction(fn)` in `src/server/db.ts` is the only way services start a transaction; the integration test proves it runs on the real DB. |
| V | Database-Enforced Integrity | PASS | Migrations only through `prisma migrate`; entrypoint and integration setup both run `migrate deploy`. No schema yet. |
| VI | Layered Feature Architecture | PASS | Lint blocks ORM imports outside `*.repository.ts` / `src/server/db.ts`, and server imports in client code; `server-only` makes the build fail too; tests prove both (R6). TS strict, `no-explicit-any` on. |
| VII | Security by Default | PASS | Env validated at startup; pino redaction; generic Arabic 500; Origin check on mutating requests; security headers + CSP; no secrets in repo/CI; `.env.example`. Known limit: CSP allows inline scripts (R11). |
| VIII | Scope Discipline and Simplicity | PASS | Only agreed tools, plus the packages in research.md R5, each with a reason, approved by the user on 2026-11-12. Assumptions recorded in the README. |

**Post-design re-check**: all PASS.

## Departures from the agreed plan notes

These are small, but the notes say "do not change without asking". The user approved all four on 2026-11-12.

1. **Session check in the route wrapper** cannot work before phase 2 (no Session table, no `requireUser`).
   Phase 0 ships the `auth` option, and `"user"` fails closed with 401. Phase 2 plugs in the real check.
2. **Folders not created yet**: `src/server/auth/` (phase 2) and `src/server/audit.ts` (phase 1/2) need
   tables that do not exist. AGENTS forbids empty files, so they are created when they get content.
   Empty folders that must exist now (`src/features/`, `src/shared/components/ui/`) get a `.gitkeep`.
3. **Extra npm scripts**: `db:generate` (`prisma generate`; Prisma 7 needs it before `typecheck`
   on a fresh clone) and `format` (`prettier --write .`). The agreed scripts are unchanged.
4. **Home page** (see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/001-project-setup/
├── plan.md              # This file
├── research.md          # Phase 0: versions, spike results, decisions
├── data-model.md        # Phase 1: no tables; configuration and error-code catalogue
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── api-response.md  # response envelope, error codes, wrapper behaviour
│   ├── environment.md   # every environment variable
│   └── commands.md      # npm scripts, docker compose, CI behaviour
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root): every file created or changed

```text
# Root config (all new)
package.json                      # scripts, pinned deps
package-lock.json
tsconfig.json                     # strict, @/ → src/, allowImportingTsExtensions (noEmit)
next.config.ts                    # security headers + CSP, poweredByHeader false
postcss.config.mjs                # @tailwindcss/postcss
eslint.config.mjs                 # next config, tanstack query, layer rules (R6)
.prettierrc.json
.prettierignore
components.json                   # shadcn: aliases → src/shared/components/ui, src/shared/lib
vitest.config.ts                  # unit
vitest.integration.config.ts      # integration
prisma.config.ts                  # schema path, migrations path, seed cmd, env("DATABASE_URL")
.env.example                      # every app variable + TEST_DATABASE_URL (tooling only), no real secrets
.gitignore                        # node_modules, .next, .env*, !.env.example, src/generated
.nvmrc                            # 22
.dockerignore
Dockerfile                        # deps → build → runner, node:22-bookworm-slim; dummy DATABASE_URL inline on the generate RUN only
docker-compose.yml                # db (healthcheck, init SQL, volume db-data → /var/lib/postgresql) + app (depends_on healthy)
README.md                         # Running, ports, Assumptions (seeded with phase 0 decisions)

# Docker support
docker/app/entrypoint.sh          # check env → migrate deploy → db seed → next start
docker/db/init/01-create-test-db.sql   # CREATE DATABASE aqar_test

# Database
prisma/schema.prisma              # generator prisma-client → src/generated/prisma; datasource postgresql; no models
prisma/seed.ts                    # idempotent; nothing to seed in phase 0

# Scripts
scripts/check-env.ts              # run with node --conditions=react-server; exits 1 with the list

# CI
.github/workflows/ci.yml

# Application
src/instrumentation.ts            # register(): getEnv() on Node runtime, exit on failure
src/app/layout.tsx                # <html lang="ar" dir="rtl">, IBM Plex Sans Arabic, <Providers>
src/app/page.tsx                  # placeholder Arabic home page
src/app/globals.css               # tailwind + shadcn theme tokens
src/features/.gitkeep
src/server/db.ts                  # Prisma singleton (adapter-pg), withTransaction, type Tx
src/server/env.ts                 # parseEnv, getEnv, EnvError
src/server/logger.ts              # pino + redact
src/server/http/app-error.ts
src/server/http/error-codes.ts
src/server/http/route-handler.ts  # handleRoute({ auth, handler })
src/shared/lib/error-messages.ts  # Arabic message per code
src/shared/lib/query-client.ts    # getQueryClient(), staleTime 30s
src/shared/lib/utils.ts           # cn() from shadcn init
src/shared/components/providers/providers.tsx   # "use client": QueryClientProvider + sonner Toaster
src/shared/components/providers/index.ts
src/shared/components/ui/.gitkeep

# Tests
tests/unit/server/env.test.ts
tests/unit/server/logger.test.ts
tests/unit/server/http/route-handler.test.ts
tests/unit/shared/lib/error-messages.test.ts
tests/unit/architecture/import-rules.test.ts
tests/unit/architecture/conventions.test.ts
tests/unit/next-config.test.ts
tests/unit/scripts/check-env.test.ts
tests/integration/setup/global-setup.ts
tests/integration/server/db.test.ts
```

Generated, not committed: `src/generated/prisma/**`, `.next/`, `next-env.d.ts`.
No `public/` folder in this phase (nothing to serve); the Dockerfile does not copy it.

**Structure Decision**: one Next.js project with the AGENTS.md layout: `src/app` (routing only),
`src/features` (empty until phase 3), `src/server` (backend infrastructure), `src/shared` (code used by
both sides), `tests/unit` and `tests/integration` mirroring `src/`, and `prisma/` for schema, migrations and seed.

## Requirement → proof map

"Auto" = an automated test proves it. "Manual" = a step in [quickstart.md](./quickstart.md).
Startup and Docker behaviour (FR-001–003) are only manual: no test framework here drives `docker compose`.

| Req | Proof | Kind |
|---|---|---|
| FR-001 clean clone → `docker compose up` runs a production build | quickstart §1 | Manual |
| FR-002 waits for healthy DB, migrates, seeds when empty | quickstart §1 (logs), §2 (restart) | Manual |
| FR-003 Arabic RTL home page, mobile + desktop | quickstart §1 (`curl` checks `lang="ar" dir="rtl"`), §3 (browser widths) | Manual |
| FR-004 security headers | `tests/unit/next-config.test.ts`; quickstart §1 (`curl -I`) | Auto + Manual |
| FR-005 folder structure | `tests/unit/architecture/conventions.test.ts` (walks `src/server`); review of the tree above | Auto (partial) |
| FR-006 db/tx helper, env, logger, errors, wrapper | `tests/integration/server/db.test.ts`, `tests/unit/server/env.test.ts`, `tests/unit/server/logger.test.ts`, `tests/unit/server/http/route-handler.test.ts`, `tests/unit/shared/lib/error-messages.test.ts` | Auto |
| FR-007 query client + toaster in root layout | `npm run build` + quickstart §1 | Manual |
| FR-008 `server-only` in every server file | `tests/unit/architecture/conventions.test.ts` | Auto |
| FR-009 kebab-case names | `tests/unit/architecture/conventions.test.ts` asserts kebab-case for every path under `src/` and `tests/` | Auto |
| FR-010 ORM import outside repositories fails lint (package, alias, relative) | `tests/unit/architecture/import-rules.test.ts` | Auto |
| FR-011 server import in client code fails lint/build | `tests/unit/architecture/import-rules.test.ts` (lint); quickstart §5 (build) | Auto + Manual |
| FR-012 automated proof of the lint rule | `tests/unit/architecture/import-rules.test.ts` itself | Auto |
| FR-013 refuse to start, list all failures, no secret values | `tests/unit/server/env.test.ts` (parse rules), `tests/unit/scripts/check-env.test.ts` (spawns the script: exit 1, names the variable); quickstart §4 (container) | Auto + Manual |
| FR-014 `.env.example` lists every variable | `tests/unit/server/env.test.ts` (keys in the schema == keys in `.env.example`) | Auto |
| FR-015 npm scripts exist | quickstart §6 | Manual |
| FR-016 strict typecheck passes | `npm run typecheck` (CI + local) | Auto |
| FR-017 unit tests need no DB | `npm run test` with the DB stopped (quickstart §6) | Manual |
| FR-018 integration tests on real, separate, auto-migrated test DB | `tests/integration/server/db.test.ts` (asserts `current_database() = 'aqar_test'`), `tests/integration/setup/global-setup.ts` (refuses non-`_test` DB, clear unreachable message, migrate deploy) | Auto |
| FR-019 tests mirror `src/` | tree above | Review |
| FR-020 PR to main runs lint + typecheck with visible result (not a required check) | quickstart §7 (after the first push) | Manual |
| FR-021 no secrets in CI | review of `ci.yml` (dummy URL on generate step only) | Review |
| FR-022 no business features | review | Review |

## Docker build: dummy database URL is build-time only

`prisma generate` refuses to run without `DATABASE_URL` (research.md R3). The Dockerfile sets a dummy
value **inline on that one `RUN` line only**, in the `build` stage:

```dockerfile
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
```

- No `ENV DATABASE_URL` and no `ARG DATABASE_URL` anywhere in the Dockerfile. An inline variable lives
  only for that one command and is not stored in the image config.
- The `runner` stage starts from a fresh `FROM`, so nothing from the `build` stage's environment
  carries over.
- `next build` does not need `DATABASE_URL`, because `getEnv()` is lazy (research.md R7).
- At runtime `DATABASE_URL` comes only from `docker-compose.yml` `environment:`, and nothing in the image can override it.
- Proof: quickstart §1 runs `docker image inspect` and checks that `DATABASE_URL` is not in the image's `Config.Env`.

## PostgreSQL 18 data volume

Checked on the local `postgres:18-alpine` image (PostgreSQL 18.6):
`PGDATA=/var/lib/postgresql/18/docker`, and the image declares `VOLUME /var/lib/postgresql`.
From 18 on, the data folder is versioned under `/var/lib/postgresql`. Mounting the old
`/var/lib/postgresql/data` path is wrong for 18: the image writes outside it, and an anonymous volume
would hold the real data.

- `docker-compose.yml` mounts the named volume `db-data` at **`/var/lib/postgresql`**.
- `PGDATA` is not overridden.
- `docker/db/init/` is mounted read-only at `/docker-entrypoint-initdb.d`.

## Integration test database

- **Created by**: `docker/db/init/01-create-test-db.sql` (`CREATE DATABASE aqar_test;`), mounted into
  `/docker-entrypoint-initdb.d`. Postgres runs it only when the data volume is empty (first start).
  An existing volume needs `docker compose down -v` once; the README says so.
- **Separate URL**: tests never read the app's `DATABASE_URL` from the developer's environment.
  `vitest.integration.config.ts` reads `TEST_DATABASE_URL` (default
  `postgresql://aqar:aqar@localhost:5432/aqar_test`) and sets `test.env.DATABASE_URL` to that value
  for the test workers. `globalSetup` uses the same value for `prisma migrate deploy`.
- **Guard**: `tests/integration/setup/global-setup.ts` aborts unless the database name ends in `_test`,
  so a wrong URL can never migrate or wipe the app database.
- **Auto-migrate** (clarification Q2): `globalSetup` runs `prisma migrate deploy` on the test database before any test.
- **Proof**: `tests/integration/server/db.test.ts` asserts `SELECT current_database()` returns `aqar_test`.
- `.env.example` lists `TEST_DATABASE_URL` under a "tooling only" comment; the app's env schema does not read it.

## CI check: not required (user decision)

The `CI / lint-typecheck` check runs on every pull request to `main` and shows pass/fail (FR-020).
It is **not** made a required status check, and no GitHub ruleset or branch protection is set up.

## Approvals (2026-11-12)

The user approved:
- The extra packages in research.md R5.
- The pins in R1–R3: TypeScript 6.0, ESLint 9, Prisma 7.10.1.
- Departures 1–4 above.
- Skipping the agent-context update (`CLAUDE.md` stays `@AGENTS.md`).

Constitution principle VIII is now **PASS**.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `src/app/page.tsx` does not call `requireUser()` and renders inline JSX, not a feature component (AGENTS §2, §7) | Phase 0 has no auth and no features; the spec wants a public placeholder page | Building a stub `requireUser()` or a fake feature would be dead code. Phase 2 replaces this page with the authenticated app shell. |
| Route wrapper `auth: "user"` always returns 401 in phase 0 | The agreed note wants the session option now; sessions arrive in phase 2 | Leaving the option out changes the agreed API; an always-allow stub would be unsafe. Failing closed is safe. |
| `.gitkeep` in `src/features/` and `src/shared/components/ui/` | FR-005 wants the folders to exist; git does not track empty folders | Creating empty `index.ts` files would break the "no empty files" rule. |
