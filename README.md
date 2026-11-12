# Aqar Lite

A multi-tenant system to sell real-estate units by installments (Next.js, PostgreSQL, Prisma).
This README grows with each phase. The current phase is **1: database schema and seed** (the home page is still an empty Arabic RTL placeholder).

## Running

You need only **Git** and **Docker** (Compose v2).

```bash
git clone <repo> aqar-lite
cd aqar-lite
docker compose up
```

Open **http://localhost:3000**. Use `localhost`, not `127.0.0.1`: mutating requests must come from the exact
origin in `APP_ORIGIN` (`http://localhost:3000`).

What `docker compose up` does:

1. Starts PostgreSQL 18. On a new data volume it creates two databases: `aqar` (the app) and `aqar_test`
   (integration tests only).
2. Builds and starts the app after the database is healthy. The app checks its settings, applies migrations,
   runs the seed (which changes nothing when data already exists), then serves a production build.

| Service  | Host address                                                 |
| -------- | ------------------------------------------------------------ |
| App      | `http://localhost:3000`                                      |
| Database | `127.0.0.1:5433` (loopback only; change with `DB_HOST_PORT`) |

The database uses host port **5433** so it does not clash with a Postgres already running on 5432.
The first build takes several minutes (base images and `npm ci`); later builds use the cache.

If you used an older volume from before the test database existed, reset it once: `docker compose down -v`.

Demo accounts (login arrives in phase 2). Password for every account: `AqarLite#2026`
(demo only; stored only as an Argon2id hash).

| Company | Role | Name | Email |
|---|---|---|---|
| شركة الأفق للتطوير العقاري | Manager | مدير الأفق | `manager@ufuq.test` |
| شركة الأفق للتطوير العقاري | Accountant | محاسب الأفق | `accountant@ufuq.test` |
| شركة الأفق للتطوير العقاري | Sales rep | مندوب الأفق 1 | `sales1@ufuq.test` |
| شركة الأفق للتطوير العقاري | Sales rep | مندوب الأفق 2 | `sales2@ufuq.test` |
| شركة النخبة العقارية | Manager | مدير النخبة | `manager@nukhba.test` |
| شركة النخبة العقارية | Accountant | محاسب النخبة | `accountant@nukhba.test` |
| شركة النخبة العقارية | Sales rep | مندوب النخبة 1 | `sales1@nukhba.test` |
| شركة النخبة العقارية | Sales rep | مندوب النخبة 2 | `sales2@nukhba.test` |

## Development

Needs Node 22 and npm 10 (`.nvmrc`, `engines` in `package.json`). With nvm: `nvm install && nvm use`.

```bash
npm ci
cp .env.example .env
npm run db:generate
docker compose up -d db
npm run dev
```

| Script                                   | What it does                                                       |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `dev` / `build` / `start`                | Next.js dev server, production build, production server            |
| `lint`                                   | ESLint, including the layer import rules                           |
| `typecheck`                              | `tsc --noEmit` (strict)                                            |
| `test`                                   | Unit tests (no database needed)                                    |
| `test:integration`                       | Integration tests on `aqar_test` (needs `docker compose up -d db`) |
| `db:migrate` / `db:seed` / `db:generate` | Prisma migrate dev, seed, generate client                          |
| `format`                                 | Prettier                                                           |

Integration tests read `TEST_DATABASE_URL` (default `postgresql://aqar:aqar@localhost:5433/aqar_test`),
apply all migrations to it before running, and refuse any database whose name does not end in `_test`.

## Technical decisions

- **Production build in Docker.** The image builds the app and runs `next start`, so reviewers see what would
  ship. Developers use `npm run dev` for hot reload.
- **Version pins.** TypeScript 6.0 (not 7: `typescript-eslint` supports `<6.1`), ESLint 9 (not 10: plugins used
  by `eslint-config-next` support up to 9), Prisma 7.10.1 pinned exactly (npm's `latest` tag for the Prisma CLI
  points to an 8.0 release candidate).
- **Prisma 7 with `@prisma/adapter-pg`.** Prisma 7 has no built-in query engine and needs a driver adapter.
- **Settings are checked at startup, never at build time.** `getEnv()` is lazy, so building the image needs no
  secrets. The container entrypoint and `src/instrumentation.ts` both refuse to start with a bad setting and list
  every bad variable without printing values.
- **Layer rules are enforced by tooling.** ESLint blocks ORM imports outside `*.repository.ts` and
  `src/server/db.ts`, and server imports in client and shared code. Every server file starts with
  `import "server-only"`, so `next build` also fails if client code imports it. Tests prove both.
- **The Arabic font is committed.** IBM Plex Sans Arabic (400, 500, 700; woff2; SIL OFL 1.1 in
  `src/shared/fonts/ofl.txt`) loads with `next/font/local`, so the build works with no network and the page
  needs no external font or style source (`font-src 'self'`).
- **Rejected:** `output: "standalone"` (it leaves out the Prisma CLI needed for `migrate deploy`), a separate
  migration service (more moving parts), Testcontainers (the Compose database is enough).

## Assumptions

- There is no login yet; the home page is a public placeholder that phase 2 replaces.
- Area is in whole m². Unit types are apartment, villa, townhouse and duplex.
- The database refuses cross-company links with composite foreign keys; services still filter by company.
- Emails are stored trimmed and lowercase.
- The seed runs in one transaction and skips when its first company exists.
- Integration tests rebuild the `aqar_test` schema on every run.
- `docker compose up` supplies non-secret local development settings, so a clean clone needs no `.env`.
  "Refuses to start" applies to the settings the app actually receives. An empty value counts as missing.
- The database is published on `127.0.0.1:5433` only, never on the network.
- The CI check (lint and typecheck on every pull request to `main`) runs and shows pass or fail. It is not a
  required check.
- Until sessions exist (phase 2), API routes that need a user always answer 401.

## Security

Phase 0 controls: settings validated at startup; secrets only in environment variables (`.env.example` has
none); logs redact password, token, cookie and authorization fields; unknown errors return a generic Arabic
message and details go only to the log; mutating API requests must carry the app's exact `Origin`; security
headers (CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`); no `X-Powered-By`;
the database listens on loopback only; the app container runs as a non-root user.

Known limits:

- The CSP allows inline scripts (`'unsafe-inline'`). A nonce-based CSP needs a proxy on every request; it is
  not worth it for this test.
- Log redaction reaches one level of nesting (`user.password`), not deeper. Request bodies are never logged raw.

The "3 biggest risks" section is written in the final phase.

## Not done

Business features (units, clients, reservations, contracts, payments, audit log) arrive in phases 1–7.

- The app connects as the table owner, which could deliberately disable the append-only triggers.
  The fix is a separate migration owner role and a low-privilege app role, with `UPDATE`, `DELETE` and
  `TRUNCATE` revoked on `payments` and `audit_logs`, and two database URLs (migrations and app).

## AI tools

Claude Code and Codex were used to write the specs, plans and tasks for each phase, to implement the code, and to
review it. Every change was re-run and reviewed before it was committed.
