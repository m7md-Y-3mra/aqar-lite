# Research: Database Schema and Seed

**Feature**: `002-schema-seed` | **Date**: 2026-11-12

Versions are the phase 0 pins (`specs/001-project-setup/research.md` R1–R4): Prisma **7.10.1**
(`prisma`, `@prisma/client`, `@prisma/adapter-pg`), generator `prisma-client` → `src/generated/prisma`,
`postgres:18-alpine`, Node 22, `@node-rs/argon2` 2.2.2. No new dependency in this phase.

Results marked **Observed** come from a throwaway project in the scratchpad with these exact versions
and a `postgres:18-alpine` container (2026-11-12). The spike schema is the one in [data-model.md](./data-model.md).

## R1. Company-aware links (clarification Q3)

- **Decision**: every model that other tenant rows point to gets `@@unique([companyId, id])` (User, Unit,
  Client, Reservation). Each tenant link is a composite FK `(company_id, x_id) → x(company_id, id)`.
  The same `companyId` column also carries the plain FK to `companies`.
  Links made company-aware: client → sales rep; reservation → unit, client, sales rep; contract → reservation.
- **Observed**:
  - Prisma 7.10.1 accepts one `companyId` column used in several relations. `prisma validate` passes, and
    `migrate dev --create-only` writes one FK per relation.
  - A 1-to-1 relation over a composite FK (contract → reservation) needs a composite unique on the
    defining side. Prisma error P1012 otherwise. Fix: `Contract` keeps `reservationId @unique` (one contract per
    reservation, FR-017) **and** `@@unique([companyId, reservationId])` (required by Prisma for the composite FK).
  - `INSERT INTO clients` with a sales rep of another company → `23503` on `clients_company_id_sales_rep_id_fkey`.
  - `INSERT INTO reservations` with a unit of another company → `23503` on `reservations_company_id_unit_id_fkey`.
- **Rationale**: the database refuses a cross-company link even if a service has a bug (spec FR-015a).
  The cost is 4 extra unique indexes. Adding this later would need a data migration.
- **Alternatives considered**:
  - Service-only checks (rejected in clarification Q3).
  - Also forcing "the client belongs to the same sales rep as the reservation" with a 3-column FK
    `(company_id, sales_rep_id, client_id)`. Rejected: not in the spec; phase 4 checks it in the service and has a test for it.
  - A trigger that checks `role = 'SALES'` for `clients.sales_rep_id` / `reservations.sales_rep_id`. Rejected:
    more raw SQL for a rule the services check on every write. Recorded in Assumptions.

## R2. Referential actions: no cascade anywhere

- **Decision**: every relation sets `onDelete: Restrict, onUpdate: Restrict` explicitly.
- **Rationale**: Prisma's defaults are `onUpdate: Cascade` on every relation and `onDelete: SetNull` on
  optional relations (both `AuditLog` relations). Leaving them would break "no cascade" (agreed note, FR-015).
- **Observed**: the generated migration has 0 lines matching `CASCADE` or `SET NULL`.
  `DELETE FROM units` for a unit with a reservation → `23001` (restrict violation).

## R3. CHECK constraints and the index Prisma cannot express

- **Decision**: one migration created with `prisma migrate dev --name init_schema --create-only`; the CHECK
  constraints and the failed-login index are appended to that `migration.sql` by hand **before** it is
  applied, then `prisma migrate dev` applies it. Editing a migration before it is applied is allowed by
  AGENTS.md §5 ("never edit an applied migration").
- **Failed-login index**: partial expression index
  `audit_logs ((meta ->> 'email'), created_at) WHERE action = 'LOGIN_FAILED'` (agreed note: "index to count
  recent LOGIN_FAILED rows by email"). The email lives in `meta.email`, so no new column is needed.
- **Observed**:
  - After applying the migration with the CHECKs, the partial expression index and the triggers,
    a second `prisma migrate dev --create-only` writes **an empty migration** ("-- This is an empty migration.").
    Prisma 7.10.1 ignores CHECK constraints, triggers and expression indexes when it diffs, so there is no drift
    and no `DROP INDEX`.
  - Every CHECK fires with SQLSTATE `23514` and its constraint name.
- **Fallback (not needed)**: if a later Prisma version shows drift, use the native `@@index([action, createdAt])`,
  which stays inside the agreed fields.

## R4. Email: case-insensitive uniqueness

- **Decision**: `users.email` keeps the native unique index, plus
  `CHECK (email = lower(btrim(email)) AND email <> '')`. Only normalized emails can be stored, so the plain
  unique index is case-insensitive in effect (spec FR-003).
  The same rule applies to `meta.email` on `LOGIN_FAILED` audit rows (FR-012):
  `CHECK (action <> 'LOGIN_FAILED' OR (coalesce(meta ->> 'email', '') <> '' AND meta ->> 'email' = lower(btrim(meta ->> 'email'))))`.
  The `coalesce` matters: a missing `email` key makes `meta ->> 'email'` NULL, and a CHECK that evaluates to NULL
  passes. Without it, a phase 2 bug that forgets the email would silently switch off the lockout.
- **Observed**: inserting `R@A.test` → `23514 users_email_normalized_check`; inserting a `LOGIN_FAILED` row with
  `"X@y.test"` → `23514 audit_logs_login_failed_email_check`. (The spike used the first form; the NULL case is covered
  by the integration test "rejects LOGIN_FAILED without an email".)
- **Alternatives considered**: `citext` (rejected: an extension and a type Prisma maps poorly); a unique index on
  `lower(email)` (rejected: lets mixed-case emails in, so login lookups would also need `lower()`).
- **Contract for phase 2**: normalize with `trim().toLowerCase()` before every lookup and before writing `LOGIN_FAILED`.

## R5. Append-only payments and audit logs

- **Decision**: a separate migration `append_only_guards` (created with `--create-only`, filled by hand) holds
  one trigger function `reject_append_only_change()` that raises SQLSTATE **`AQ001`**, and four triggers:
  `BEFORE UPDATE OR DELETE … FOR EACH ROW` and `BEFORE TRUNCATE … FOR EACH STATEMENT`, on `payments` and on `audit_logs`.
- **Why TRUNCATE**: row-level triggers do not fire on TRUNCATE. Without a statement-level trigger,
  `TRUNCATE payments` would empty the table (spec Story 3, scenario 5).
- **Why a custom SQLSTATE**: tests assert the exact code, so a test cannot pass because of an unrelated error.
- **Observed**: UPDATE, DELETE and TRUNCATE on both tables fail with `AQ001`
  ("append-only table payments: UPDATE is not allowed"). INSERT works. The row is still there afterwards.
- **Honest limit**: the compose stack connects the app as `aqar`, the `POSTGRES_USER` superuser that also owns
  the tables. Triggers fire for superusers, so every UPDATE, DELETE and TRUNCATE fails. But that same account
  could switch the triggers off on purpose (`ALTER TABLE … DISABLE TRIGGER`, or
  `SET session_replication_role = replica`). The guarantee covers every statement the application sends,
  not a deliberate attack with the owner's credentials.
  - **Not done in this phase**: a separate least-privilege runtime role (no ownership, no `TRUNCATE`, no
    `ALTER`). It changes phase 0's compose file, env and entrypoint, and does not fit the phase 1 time budget.
    It goes in the README "Not done" section with how to build it.
- **Alternatives considered**: `REVOKE UPDATE, DELETE` only (rejected: the owner and superusers ignore grants,
  and phase 0 uses the owner); rules (`CREATE RULE … DO INSTEAD NOTHING`) (rejected: fail silently, and the
  spec wants a visible failure).

## R6. Column types

- **Decision**:
  - IDs: `uuid` with `DEFAULT gen_random_uuid()` (`@default(dbgenerated("gen_random_uuid()")) @db.Uuid`).
    `sessions.id` is `text` (hex SHA-256 of the token, written by phase 2).
  - Money: `bigint` halalas (`BigInt`). Area and rooms: `integer` (whole m², clarification Q1).
  - Instants (`expires_at`, `approved_at`, `created_at`): `timestamptz(3)`.
  - `installments.due_date`: `date`.
  - Names: snake_case tables and columns through `@@map`/`@map`, so raw SQL in migrations and tests needs no quoting of camelCase.
- **Observed**: `BigInt` columns come back as JS `bigint` through the adapter.
- **Contract for phase 5** (`dueDate`): Prisma reads and writes a `date` as UTC midnight. Phase 5 must build each
  due date as `new Date(Date.UTC(y, m - 1, d))` from the Riyadh calendar day. Using the instant of Riyadh
  midnight (21:00 UTC the day before) would store the day before.

## R7. Seed

- **Decision**:
  - `prisma/seed.ts` stays the entry point (phase 0's `prisma.config.ts` runs `node prisma/seed.ts`). It
    creates the Prisma client with `@prisma/adapter-pg`, calls `runSeed(prisma)` and disconnects.
  - `prisma/run-seed.ts` exports `runSeed(db)`, so the integration test runs the same code against the test database.
  - `prisma/seed-data.ts` holds the data as plain constants with **fixed UUIDs** for companies, users,
    units and clients.
  - **Skip rule**: if the first seed company id exists, log "seed data already present" and return.
    Everything else runs in **one transaction**, so the database never holds half a seed, and "first company
    exists" means "the whole seed exists". The check is keyed on the seed company id, not on "any company",
    because integration tests create their own companies in the same test database.
  - Passwords: one shared demo password, hashed with `@node-rs/argon2` `hash()` (its default algorithm is
    Argon2id; phase 2 verifies with the parameters stored in the hash string). All hashes are computed
    before the transaction starts, so the transaction stays short.
  - Money is written directly as halala `bigint` literals with a riyal comment (for example
    `45_000_000n // 450,000 SAR`), so the seed does not convert riyals (AGENTS.md §4 keeps that in `src/shared/lib/money.ts`).
- **Observed**:
  - `node prisma/seed.ts` and `npx prisma db seed` both run a seed that imports
    `../src/generated/prisma/client.ts` with Node 22 type stripping. No `tsx`, no `importFileExtension` change.
  - Without `"type": "module"` in `package.json`, Node prints a "reparsing as ES module" warning and still runs. Harmless; not changed here.
  - `hash()` output starts with `$argon2id$`.
- **Alternatives considered**: upsert of every row by id (rejected: re-hashes passwords on every run and hides a
  half-seeded database); "skip if any company exists" (rejected: test companies would make the seed test skip).

## R8. Integration tests on append-only tables

- **Decision**:
  - `tests/integration/setup/global-setup.ts` (phase 0 file) gets one new step **after** its `_test` name guard
    and its connection check: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`, then the existing
    `prisma migrate deploy`. Each run starts from an empty, fully migrated test database.
  - Inside a run, tests never clean up. Each test creates its own company (random UUID, unique emails) through
    small fixture helpers, so tests do not see each other's rows.
  - Negative tests use direct SQL (`$executeRaw` / `$executeRawUnsafe` with parameters) and assert the exact
    SQLSTATE **and** constraint name. Each has a positive control (a valid row is accepted).
- **Observed**:
  - `DROP SCHEMA public CASCADE` succeeds on a schema with the append-only triggers (DROP fires no
    row or TRUNCATE triggers).
  - Error shape through `@prisma/adapter-pg`: raw SQL errors are `PrismaClientKnownRequestError` `P2010`;
    a unique error through a model call is `P2002`. In both cases the Postgres SQLSTATE is in
    `error.meta.driverAdapterError.cause.originalCode` (`23514`, `23505`, `AQ001`, …) and the constraint name is in
    `cause.originalMessage`. One test helper, `expectDbError(promise, { code, constraint? })`, reads these two
    fields **by shape**, without importing Prisma error classes, so every negative test asserts both.
- **Imports in tests**: test files get the client from `@/server/db` (phase 0) and never import the generated
  client. Phase 0's ORM lint ban covers only `src/**`, so this is a choice for clarity, not a lint requirement;
  `eslint.config.mjs` does not change. The seed test passes that same client to `runSeed(db)`.
- **Alternatives considered**: `prisma migrate reset --force` (rejected: its seeding behaviour changed across
  Prisma versions, and a plain DROP is easier to read); one rolled-back transaction per test (rejected: a test
  that expects an error aborts the transaction, so each needs a savepoint; more code for no gain).
