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

Open **http://localhost:3000**. Mutating requests must come from an origin listed in `APP_ORIGIN`, a
comma-separated list matched entry by entry; the shipped value allows `http://localhost:3000` and
`http://127.0.0.1:3000`.

The session cookie is `Secure`. Browsers accept `Secure` cookies on `http://localhost`: tested on Chromium
(login on `http://localhost:3000` and `http://127.0.0.1:3000`); Chrome and Firefox accept them too. Safari was not
tested.

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

Demo accounts. Log in at http://localhost:3000/login. Password for every account: `AqarLite#2026`
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
- **Login is serialized per email.** `login()` takes a Postgres advisory lock on the email inside its
  transaction, so parallel attempts cannot all read "4 failures" and all guess. The lock count reads the
  existing `meta->>'email'` audit index.
- **`GET /api/auth/me`** returns the current user's name, role and company, or 401. Tests use it to prove a
  session works or is dead; the pages read the user on the server with `requireUser()`.
- **Rejected:** `output: "standalone"` (it leaves out the Prisma CLI needed for `migrate deploy`), a separate
  migration service (more moving parts), Testcontainers (the Compose database is enough).

## Assumptions

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
- Sessions last a fixed 7 days from login (no sliding renewal). Logout ends only the current device's session.
- Login lock (phase 2): every failed login is written to the audit log with a reason, `invalid_credentials`
  (wrong email or password) or `locked` (refused because the email is locked). An email is locked while it has 5
  or more `invalid_credentials` rows in the last 15 minutes. `locked` rows are not counted, so retries during the
  lock never extend it: it ends 15 minutes after the oldest of those 5 failures. While locked, the password is not
  checked, the message is the same generic one, and the response time stays similar. Emails are counted trimmed
  and lowercase, whether or not the account exists.

## Security

Phase 0 controls: settings validated at startup; secrets only in environment variables (`.env.example` has
none); logs redact password, token, cookie and authorization fields; unknown errors return a generic Arabic
message and details go only to the log; mutating API requests must carry an `Origin` listed in `APP_ORIGIN`
(exact match); security headers (CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`); no `X-Powered-By`;
the database listens on loopback only; the app container runs as a non-root user.

Phase 2 controls: passwords hashed with Argon2id; database sessions where the cookie holds a random 32-byte
token and the database stores only its SHA-256 hash; the cookie is `HttpOnly`, `Secure`, `SameSite=Lax`,
`Path=/`, 7 days; logout deletes the session row, so a copied token stops working; one generic message for a
wrong email, a wrong password and a locked email; an unknown email still runs one Argon2id verify, so response
time does not reveal whether the account exists; every failed login is audited; an email is locked after 5
failures in 15 minutes (limits below); every page and API route checks the session on the server, with no
middleware.

Known limits:

- The CSP allows inline scripts (`'unsafe-inline'`). A nonce-based CSP needs a proxy on every request; it is
  not worth it for this test.
- Log redaction reaches one level of nesting (`user.password`), not deeper. Request bodies are never logged raw.
- The login lock is per email (phase 2). It stops guessing one account's password, but not password spraying
  (a few common passwords tried against many accounts), and anyone who knows a user's email can lock that user
  out for 15 minutes on purpose.

The "3 biggest risks" section is written in the final phase.

## Not done

Business features (units, clients, reservations, contracts, payments, audit log) arrive in phases 1–7.

- The app connects as the table owner, which could deliberately disable the append-only triggers.
  The fix is a separate migration owner role and a low-privilege app role, with `UPDATE`, `DELETE` and
  `TRUNCATE` revoked on `payments` and `audit_logs`, and two database URLs (migrations and app).
- No per-IP login limit and no CAPTCHA. With more time: a per-IP limit when deployed behind a trusted proxy, with
  the client IP taken only from that proxy's header, or a CAPTCHA after repeated failures. It is not built now
  because `docker compose up` has no proxy: requests reach the app through Docker's network, so the app sees
  the Docker gateway address instead of each user's address. A per-IP limit would then either block everyone at
  once or have to trust a forwarding header that any client can fake.

## AI tools

Claude Code and Codex were used to write the specs, plans and tasks for each phase, to implement the code, and to
review it. Every change was re-run and reviewed before it was committed.
