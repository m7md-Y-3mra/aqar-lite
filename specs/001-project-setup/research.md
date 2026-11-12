# Research: Project Setup and Tooling

**Feature**: `001-project-setup` | **Date**: 2026-11-12

Every version below was checked with `npm view` / the GitHub API on 2026-11-12, not guessed.
Spike results (marked **Observed**) come from a throwaway project with the exact versions and a
`postgres:18-alpine` container.

## R1. Runtime and framework versions

- **Decision**: Node 22 LTS (local: v22.23.2), npm, Next.js **16.4.6**, React **19.3.x**, TypeScript **6.0.3**.
- **Rationale**: Next 16.4.6 is the latest stable. TypeScript `latest` is 7.0.2, but
  `typescript-eslint@8.72.2` (pulled in by `eslint-config-next`) requires `typescript >=4.8.4 <6.1.0`.
  TS 7 would break lint, so we pin the newest 6.0.x.
- **Alternatives considered**: TypeScript 7 (rejected: peer range above); Node 24 (rejected: agreed note says Node 22).

## R2. ESLint version

- **Decision**: ESLint **9.39.x** with flat config (`eslint.config.mjs`), `eslint-config-next@16.4.6`,
  `@tanstack/eslint-plugin-query@5.107.x`. `npm run lint` = `eslint .` (Next 16 has no `next lint`).
- **Rationale**: ESLint `latest` is 10.14.0, but `eslint-plugin-react` and `eslint-plugin-import`
  (both pulled in by `eslint-config-next`) declare peers up to `^9`.
- **Alternatives considered**: ESLint 10 (rejected: peer conflicts, would need `--legacy-peer-deps`).

## R3. Prisma version and connection

- **Decision**: Pin **exactly** `prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-pg@7.10.1`.
  Generator `prisma-client` with output `src/generated/prisma` (git-ignored, lint-ignored).
  `prisma.config.ts` holds the datasource URL via `env("DATABASE_URL")` and the seed command.
- **Rationale**: `prisma`'s `latest` dist-tag currently points to `8.0.0-rc.33` (a release candidate),
  while `@prisma/client`'s `latest` is 7.10.1. A bare `npm i prisma` would install an RC and mismatch
  the client. Prisma 7 has no built-in query engine: the client needs a driver adapter, so
  `@prisma/adapter-pg` (which depends on `pg`) is required to talk to PostgreSQL at all.
- **Observed**:
  - `prisma generate` with **zero models** succeeds and writes a client (`client.ts`, `models.ts`, …).
  - `prisma generate` **fails** when `DATABASE_URL` is unset (`PrismaConfigEnvError: Cannot resolve
    environment variable: DATABASE_URL`) because `env()` is strict. CI and the Docker build therefore
    pass a dummy, non-secret URL for the generate step only.
  - `prisma migrate deploy` with **no** `prisma/migrations` folder: "No pending migrations to apply", exit 0.
  - `prisma db seed` with `seed: "node prisma/seed.ts"` runs a plain `.ts` file through Node 22's
    built-in type stripping. No `tsx` needed.
  - A query through `PrismaClient({ adapter: new PrismaPg(...) })` works when run with Node type stripping.
- **Phase 1 note**: the seed will import the generated client. If Node type stripping cannot resolve
  the generated imports, phase 1 sets the generator's `importFileExtension = "ts"` option before reaching for `tsx`.
- **Alternatives considered**: Prisma 8 RC (rejected: not stable); Drizzle (rejected: agreed note says Prisma).

## R4. Other agreed dependencies (versions)

| Package | Version | Note |
|---|---|---|
| tailwindcss + @tailwindcss/postcss | 4.3.5 | Tailwind v4 needs the PostCSS plugin package |
| shadcn (CLI, run with npx, not installed) | 4.23.0 | `init` adds `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css` |
| sonner | 2.0.8 | use sonner's own `Toaster`; **not** the shadcn wrapper (it pulls in `next-themes`) |
| @tanstack/react-query | 5.107.1 | |
| zod | 4.6.7 | |
| react-hook-form / @hookform/resolvers | 7.92.0 / 7.0.6 | resolvers peers: `zod ^3.25 || ^4`, `react-hook-form ^7.55` ✓ |
| date-fns / @date-fns/tz | 4.4.0 / 1.5.0 | installed now, used from phase 4 |
| @node-rs/argon2 | 2.2.2 | installed now, used from phase 2; prebuilt for linux-x64-gnu (Debian image) |
| pino | 10.4.0 | no transports (no worker threads); Next lists pino as a server-external package by default |
| server-only | 0.0.1 | |
| vitest | 5.1.0 | engines `^22.12 || ^24 || >=26` ✓ |
| prettier | 3.10.1 | |

## R5. Packages outside the agreed list (needs user approval)

| Package | Why it is needed |
|---|---|
| `@prisma/adapter-pg` (+ `pg` transitively) | Prisma 7 cannot connect to Postgres without a driver adapter (R3). |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | Required by "TypeScript strict" itself. |
| `eslint`, `eslint-config-next` | Required by "ESLint" itself; Next's official rules (react, hooks, a11y, typescript-eslint). |
| `@tailwindcss/postcss` | Tailwind v4's only Next.js integration. |
| `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css` | Installed by `shadcn init`; every shadcn component depends on them. |

Nothing else. In particular: no `tsx` (Node type stripping is enough, R3), no `dotenv`
(Node's `process.loadEnvFile()` is enough, R7), no `vite-tsconfig-paths` (a plain `resolve.alias` is enough),
no `next-themes`, no `eslint-config-prettier` (no stylistic ESLint rules are enabled, so nothing conflicts).

## R6. Enforcing the layer rules

- **Decision**: ESLint `no-restricted-imports` with **pattern constants composed per file group**:
  - `ORM_PATTERNS`: `@prisma/*`, `@/generated/*`, `**/generated/prisma`, `**/generated/prisma/**`.
  - `SERVER_PATTERNS`: `@/server/*`, `@/features/*/server/*`, `**/server/**` relative forms, `server-only`.
  - Group "all of `src/`": bans `ORM_PATTERNS`.
  - Group "client code" (`src/features/*/client/**`, `src/shared/**`, `src/app/**/*.tsx` except route
    files): bans `ORM_PATTERNS` **plus** `SERVER_PATTERNS` (with `allowTypeImports: true`, so
    `src/shared/lib/error-messages.ts` can `import type` the error code union).
  - Override with no restriction: `src/**/*.repository.ts`, `src/server/db.ts`, `prisma/**`,
    `scripts/**`, `tests/integration/setup/**`.
- **Why composed constants**: in flat config a later object that sets the same rule **replaces** the
  earlier options; it does not merge. A client block that only lists server patterns would silently
  drop the ORM ban. Building both arrays as constants avoids that.
- **Second layer**: every file in `src/server/` and `src/features/*/server/` starts with
  `import "server-only"`, so `next build` fails if a client component imports one. A unit test (`tests/unit/architecture/conventions.test.ts`) checks the first line of every such file and that every path is kebab-case.
- **Proof**: `tests/unit/architecture/import-rules.test.ts` uses the ESLint Node API (`lintText` with a
  virtual `filePath`) and asserts errors for: package import, `@/` alias, relative path to the
  generated client, ORM import in a client file, server import in a client file; and no error for a
  `*.repository.ts` file and `src/server/db.ts`.
- **Alternatives considered**: `eslint-plugin-boundaries` (rejected: new dependency; the built-in rule is enough).

## R7. Environment validation

- **Decision**: `src/server/env.ts` exports `parseEnv(source)` (pure, throws `EnvError` listing **every**
  failing key with a reason, never values) and `getEnv()` (lazy, cached). Validation runs:
  1. In the container entrypoint, **before** migrations: `node --conditions=react-server scripts/check-env.ts`.
  2. On server boot: `src/instrumentation.ts` `register()` calls `getEnv()` (Node runtime only) and exits on failure.
- **Why lazy**: `next build` imports route modules to collect page data. A module-level parse would
  make the build need runtime secrets. The clarified spec forbids that.
- **Observed**: `node --conditions=react-server` resolves `server-only` to its empty export, so the script can import
  `src/server/env.ts` directly. Without the flag, `server-only` throws, as intended.
- **Rules**: empty strings count as missing (`z.string().trim().min(1)`); `DATABASE_URL` must be a
  `postgresql://` URL; `APP_ORIGIN` must be an `http(s)` origin with no path.
- **Local `.env` for the Prisma CLI**: Prisma 7 no longer auto-loads `.env`. `prisma.config.ts` calls
  `process.loadEnvFile()` when `.env` exists (Node built-in), so no `dotenv`.
- **Alternatives considered**: validating at module import (rejected: breaks the build); a duplicate
  shell check (rejected: two sources of truth).

## R8. Docker

- **Decision**: Multi-stage `Dockerfile` on `node:22-bookworm-slim`:
  `deps` (`npm ci`) → `build` (`prisma generate` with dummy URL, `next build`) → `runner`
  (`npm prune --omit=dev` output, `.next`, `public`, `prisma/`, `prisma.config.ts`, `scripts/`,
  `src/server/env.ts`, `next.config.ts`, `package.json`; runs as user `node`).
  `prisma` is a **runtime** dependency because the entrypoint runs `prisma migrate deploy`.
- **Entrypoint** `docker/app/entrypoint.sh` (`set -eu`): check env → `prisma migrate deploy` →
  `prisma db seed` (the seed skips itself when data exists; empty in phase 0) → `exec next start`.
- **Compose**: `db` = `postgres:18-alpine`, healthcheck `pg_isready`, named volume, port 5432,
  `docker/db/init/01-create-test-db.sql` mounted into `/docker-entrypoint-initdb.d` (creates
  `aqar_test` on first start only). `app` builds the Dockerfile, `depends_on: db: condition: service_healthy`,
  port 3000, `environment:` holds non-secret local development values (no `.env` needed).
- **Debian, not Alpine**: `@node-rs/argon2` and Prisma ship glibc builds by default; this avoids musl surprises.
- **Alternatives considered**: `output: "standalone"` (rejected: the traced output does not include
  the Prisma CLI needed for `migrate deploy`); a separate `migrate` service (rejected: more moving parts).

## R9. Tests

- **Decision**: two Vitest configs.
  - `vitest.config.ts` (unit): `tests/unit/**/*.test.ts`, `environment: node`, alias `@` → `src`,
    alias `server-only` → `server-only/empty.js`, `test.env` sets **all** required variables with fake values.
  - `vitest.integration.config.ts`: `tests/integration/**/*.test.ts`, same aliases,
    `fileParallelism: false`, `test.env` sets all required variables, with `DATABASE_URL` =
    `TEST_DATABASE_URL` (default `postgresql://aqar:aqar@localhost:5432/aqar_test`).
    `globalSetup` (`tests/integration/setup/global-setup.ts`):
    1. refuses to run unless the database name ends in `_test`;
    2. checks the connection and fails with "Test database not reachable … run `docker compose up -d db`";
    3. runs `prisma migrate deploy` against the test database (clarification Q2).
- **Alternatives considered**: Testcontainers (rejected: new dependency; the compose DB is enough).

## R10. HTTP layer

- **Decision**: `src/server/http/` = `app-error.ts` (`AppError(code, fieldErrors?)`), `error-codes.ts`
  (`ERROR_CODES` const map code → HTTP status), `route-handler.ts` (`handleRoute({ auth, handler })`).
  `src/shared/lib/error-messages.ts` = `Record<ErrorCode, string>` in Arabic.
  - Phase 0 codes: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `INVALID_ORIGIN` 403,
    `NOT_FOUND` 404, `INTERNAL_ERROR` 500. Later phases add their own codes.
  - Origin: on POST/PUT/PATCH/DELETE the `Origin` header must equal `APP_ORIGIN`; missing or different → 403 `INVALID_ORIGIN`.
  - `ZodError` → 400 `VALIDATION_ERROR` with `fieldErrors`; malformed JSON → 400.
  - Unknown error → 500 `INTERNAL_ERROR`, generic Arabic message; the error goes to the logger only.
  - `auth: "public" | "user"`. **Phase 0 has no session store**, so `"user"` **fails closed** with 401.
    Phase 2 replaces the resolver with the real `requireUser()`.
- **Alternatives considered**: leaving the session option out until phase 2 (rejected: the agreed note
  lists it, and failing closed is safe).

## R11. Security headers and CSP

- **Decision**: `next.config.ts` `headers()` for `/:path*`: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  (camera, microphone, geolocation off), and CSP:
  `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`.
  Development adds `'unsafe-eval'` to `script-src` (React dev tooling). `poweredByHeader: false`.
- **Rationale**: a nonce CSP needs a proxy/middleware on every request. The spec asks for a "simple" CSP. `next/font` self-hosts the font, so `font-src 'self'` is enough.
- **Trade-off**: `'unsafe-inline'` scripts are allowed. It is listed in the README Security section as a known limit.
- **No HSTS**: the local stack is plain HTTP; HSTS belongs at the TLS terminator in production.

## R12. CI

- **Decision**: `.github/workflows/ci.yml`, name `CI`, trigger `pull_request` to `main` only,
  `permissions: contents: read`, `concurrency: ci-${{ github.event.pull_request.number }}` with
  `cancel-in-progress: true`. One job `lint-typecheck` (ubuntu-latest, `timeout-minutes: 10`):
  `actions/checkout@v7` → `actions/setup-node@v7` (`node-version: 22`, `cache: npm`) → `npm ci` →
  `npx prisma generate` with `if: hashFiles('prisma/schema.prisma') != ''` and a dummy
  `DATABASE_URL` on that step only → `npm run lint` → `npm run typecheck`.
- **Versions checked**: `gh api repos/actions/checkout/releases/latest` → `v7.0.1`;
  `gh api repos/actions/setup-node/releases/latest` → `v7.1.0`. Both are official `actions/*`. No secrets are used.
- **Required check**: the status check name is the job name, `lint-typecheck`. GitHub documents
  rulesets for **GitHub Team and Enterprise** plans; on GitHub Free they are enforced only on
  public repositories. The brief requires a private repository, so on a Free personal account the check
  still **runs and shows pass/fail on every PR** (FR-020), but GitHub may not let you make it
  *required*. See plan.md "Making the check required".
- **No remote yet**: `git remote -v` shows no remote. The workflow can only be checked on GitHub after you push.
