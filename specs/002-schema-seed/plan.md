# Implementation Plan: Database Schema and Seed

**Branch**: `002-schema-seed` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-schema-seed/spec.md`

## Summary

Add every Aqar Lite entity (10 tables, 4 enums) to `prisma/schema.prisma` and create it with two migrations:
`init_schema` (Prisma-generated tables, keys and company-aware FKs, plus hand-added CHECK constraints and the
failed-login index) and `append_only_guards` (triggers that block UPDATE, DELETE and TRUNCATE on payments and
audit logs). Add an idempotent, all-or-nothing seed (2 companies × 4 users, 12 units, 6 clients) and the
integration tests that prove each database rule with direct SQL. A spike with the exact phase 0 versions
confirmed the risky parts first (research R1–R8).

## Blocker before implement

Phase 0 (`001-project-setup`) is planned but not built or merged. This branch was cut from `main` at the user's
request. Before `/speckit-implement`: build and merge phase 0, then rebase this branch onto `main`.
Every file marked "phase 0 file" below must exist first.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict), Node.js 22 LTS (phase 0 R1)

**Primary Dependencies**: Prisma 7.10.1 + `@prisma/adapter-pg` 7.10.1, `@node-rs/argon2` 2.2.2 (seed hashing).
**No new dependency.**

**Storage**: PostgreSQL 18 (`postgres:18-alpine`): `aqar` (app) and `aqar_test` (integration tests).

**Testing**: Vitest 5.1. Unit (`tests/unit`, no DB) and integration (`tests/integration`, real `aqar_test`, phase 0 config, `fileParallelism: false`).

**Target Platform**: Linux containers (Docker Compose).

**Project Type**: Web application (one Next.js project). This phase touches only `prisma/`, tests and the README.

**Performance Goals**: Seed finishes in under 10 seconds (8 Argon2id hashes + one transaction). Indexes match the
queries of phases 2–7 (data-model.md).

**Constraints**: Money only `bigint` halalas; no `Float`/`Decimal`. No cascade on any FK. Applied migrations are never edited.

**Scale/Scope**: Demo scale: 2 companies, 24 units, 12 clients. No application code in `src/` changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Source: `.specify/memory/constitution.md`.

| # | Principle | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| I | Tenant Isolation (NON-NEGOTIABLE) | PASS | Every tenant table has `company_id`. Company-aware composite FKs make cross-company links impossible in the database (clarification Q3, R1). Repositories (phase 3+) filter by `companyId`. Proof: `schema-constraints.test.ts` "cross-company links". |
| II | Server-Side Authorization | PASS (not applicable yet) | No endpoints in this phase. `role` is an enum with 3 values; the session row holds no role or company, so they are always read fresh from `users`. |
| III | Financial Accuracy | PASS | All money `bigint` halalas. Installment status and remaining amount are not stored. `due_date` is `date` with a written UTC-midnight rule for phase 5 (contracts/database.md). |
| IV | Atomic and Concurrency-Safe Operations | PASS | `UNIQUE (contract_id, idempotency_key)` backs idempotent payments; `contracts.reservation_id UNIQUE` backs one contract per reservation. Seed runs in one transaction. |
| V | Database-Enforced Integrity | PASS | Two migrations; CHECK, UNIQUE, composite FKs, no cascade; triggers block UPDATE/DELETE/TRUNCATE on payments and audit logs. Known limit: the table owner can disable triggers (R5), listed in README "Not done". |
| VI | Layered Feature Architecture | PASS | Only `prisma/**` and tests use Prisma directly (phase 0 lint override). No `src/` feature code. |
| VII | Security by Default | PASS | Seed passwords stored only as Argon2id hashes; sessions store only the token hash; emails normalized by CHECK so the phase 2 lockout cannot be bypassed by letter case. |
| VIII | Scope Discipline and Simplicity | PASS | No new dependency. Every field is from the agreed notes. Additions beyond the notes are listed below; the user approved all 8 on 2026-11-12. |

**Post-design re-check**: all PASS (departures 1–8 approved 2026-11-12).

**Agent context**: the agent-context update script was not run. `CLAUDE.md` stays only `@AGENTS.md` (docs/phases.md; approved in phase 0).

## Departures from the agreed plan notes (approved 2026-11-12)

The user approved all 8. None removes or changes an agreed field. Each one adds a database rule the spec or a clarification asks for.

1. **Company-aware links** (clarification Q3, FR-015a): `@@unique([companyId, id])` on User, Unit, Client,
   Reservation; composite FKs for client → sales rep, reservation → unit / client / sales rep, contract → reservation.
   Contract also gets `@@unique([companyId, reservationId])`, which Prisma requires for the 1-to-1 composite FK (R1).
2. **Email normalization CHECK** on `users.email` and on `LOGIN_FAILED` `meta.email`, which must also be present (FR-003, FR-012, R4).
3. **TRUNCATE triggers** in addition to UPDATE/DELETE (Story 3 scenario 5, R5).
4. **Extra small CHECKs**: unit project name and number trimmed and not empty (stops `"A-101 "` beating the
   unique rule); `installments.seq >= 0`; idempotency key not empty; session id shaped like a SHA-256 hex hash
   (added after `/speckit-analyze` finding C1, R4a; approved 2026-11-12).
5. **Extra indexes** for later queries: `units (company_id, status)`, `clients (company_id, sales_rep_id)`,
   `reservations (unit_id, expires_at)` and `(company_id, sales_rep_id)`, `sessions (user_id)`, `audit_logs (company_id, created_at)`.
6. **Phase 0 file changed**: `tests/integration/setup/global-setup.ts` drops and recreates the test schema
   (after the `_test` guard) before `migrate deploy`, because append-only rows cannot be cleaned up (R8).
7. **Seed skip rule**: "skip if data exists" is implemented as "skip if the first seed company id exists", with
   the whole seed in one transaction (R7). "Any company exists" would make the seed test skip.
8. **snake_case** table and column names via `@@map`/`@map` (R6), so raw SQL needs no quoted camelCase.

## Project Structure

### Documentation (this feature)

```text
specs/002-schema-seed/
├── plan.md              # This file
├── research.md          # Spike results and decisions (R1–R8)
├── data-model.md        # Tables, fields, rules, seed shape
├── quickstart.md        # Validation guide
├── contracts/
│   ├── database.md      # Constraint catalogue (names + SQLSTATE), what later phases must do, date/money rules
│   └── seed-accounts.md # Seed emails, roles, password (copied into README)
└── tasks.md             # /speckit-tasks output (not created here)
```

### Source Code (repository root): every file created or changed

```text
# Database
prisma/schema.prisma                                        # CHANGED (phase 0 file): 4 enums, 10 models
prisma/migrations/<timestamp>_init_schema/migration.sql     # NEW: generated with --create-only, then CHECKs + partial index appended before apply
prisma/migrations/<timestamp>_append_only_guards/migration.sql  # NEW: created with --create-only (empty), trigger function + 4 triggers added before apply
prisma/migrations/migration_lock.toml                       # NEW (generated)

# Seed
prisma/seed.ts                                              # CHANGED (phase 0 file): entry point → runSeed(prisma), disconnect
prisma/run-seed.ts                                          # NEW: runSeed(db): skip check, hash passwords, one transaction
prisma/seed-data.ts                                         # NEW: fixed-UUID companies, users, units, clients; password constant

# Tests
tests/integration/setup/global-setup.ts                     # CHANGED (phase 0 file): drop + recreate schema after the _test guard
tests/integration/support/db-fixtures.ts                    # NEW: makeCompany/User/Unit/Client/Reservation/Contract (random ids), expectDbError()
tests/integration/prisma/schema-constraints.test.ts         # NEW
tests/integration/prisma/append-only.test.ts                # NEW
tests/integration/prisma/seed.test.ts                       # NEW
tests/unit/prisma/seed-data.test.ts                         # NEW: seed data shape, no DB

# Docs
README.md                                                   # CHANGED (phase 0 file): seed accounts, Assumptions, Not done (DB roles, see below)
```

Migration workflow (AGENTS.md §5): `prisma migrate dev --name <name> --create-only` → add the raw SQL to the new
`migration.sql` → `prisma migrate dev` to apply. A migration is never edited after it is applied.
Then check for drift (quickstart §2) and for cascade (quickstart §3).

Not changed: `src/**` (no feature code), `prisma.config.ts` (the seed command `node prisma/seed.ts` already works, R7),
`eslint.config.mjs` (`prisma/**` and `tests/**` are outside the ORM ban), docker files.

**Structure Decision**: the schema, migrations and seed live in `prisma/` (outside `src/`, so they may use Prisma
directly). Tests for them live in `tests/integration/prisma/` and `tests/unit/prisma/`, mirroring the `prisma/` folder.

## Requirement → proof map

All integration tests use direct SQL or the Prisma client on `aqar_test`, and assert SQLSTATE + constraint name
through `expectDbError` (R8). Each negative test has a positive control.
Abbreviations: **SC** = `schema-constraints.test.ts`, **AO** = `append-only.test.ts`, **SD** = `seed.test.ts`, **SU** = `seed-data.test.ts`.

| Rule | Test (file › case) |
|---|---|
| FR-001/002, Story 1 sc.1: all entities exist after migrations | SC › "creates a full company → contract → installment chain" (positive path through every table); quickstart §1 |
| Story 1 sc.2: user needs company and valid role | SC › "rejects a user without a company" (23502), "rejects an unknown role" (22P02) |
| FR-003, Story 1 sc.3: email unique, case-insensitive | SC › "rejects a duplicate email" (23505 `users_email_key`), "rejects a non-normalized email" (23514 `users_email_normalized_check`) |
| FR-004: session stores a hash id | SC › "rejects a session id that is not a SHA-256 hex hash" (23514 `sessions_id_hash_check`); phase 2 tests the token flow |
| FR-014, Story 1 sc.4: reference to a missing row | SC › "rejects a unit for a missing company" (23503) |
| FR-015, Story 1 sc.5: no cascade delete | SC › "refuses to delete a unit that has a reservation" (23001); quickstart §3 |
| FR-015a, Story 2 sc.11: no cross-company links | SC › "cross-company links": client→rep, reservation→unit, reservation→client, reservation→rep, contract→reservation (each 23503 + FK name) |
| FR-016, Story 2 sc.1: unit price, area, rooms | SC › "rejects unit price ≤ 0 / area ≤ 0 / rooms < 0" (23514 + names) |
| FR-016, Story 2 sc.2–3: unit number unique per company+project | SC › "rejects duplicate project+number in one company" (23505), "accepts same project+number in another company or project" |
| Story 2 sc.4–5, FR-018: installment amounts | SC › "rejects paid amount above amount" (23514 `installments_paid_amount_check`), "accepts paid = amount", "rejects amount ≤ 0", "rejects negative paid amount" |
| Story 2 sc.6, FR-017: one contract per reservation | SC › "rejects a second contract for the same reservation" (23505 `contracts_reservation_id_key`) |
| Story 2 sc.7, FR-017: contract numbers | SC › "rejects final price ≤ 0 / down payment < 0 / down payment ≥ final price / installment count < 1"; "accepts down payment 0" |
| Story 2 sc.8, FR-018: installment position unique | SC › "rejects a duplicate seq in one contract" (23505) |
| Story 2 sc.9–10, FR-019: payment amount and key | SC › "rejects payment amount ≤ 0" (23514), "rejects a repeated key on one contract" (23505), "accepts the same key on another contract" |
| FR-022: phone not unique | SC › "accepts two clients with the same phone" |
| FR-012: failed-login email recorded and normalized | SC › "rejects LOGIN_FAILED with a mixed-case email" (23514), "rejects LOGIN_FAILED without an email" (23514), "accepts LOGIN_FAILED with no company and no user" |
| FR-020, Story 3 sc.1–2: payment UPDATE/DELETE fail | AO › "UPDATE on a payment fails", "DELETE on a payment fails" (AQ001; row re-read and unchanged) |
| FR-021, Story 3 sc.3–4: audit UPDATE/DELETE fail | AO › "UPDATE on an audit row fails", "DELETE on an audit row fails" (AQ001; row unchanged) |
| Story 3 sc.5: TRUNCATE fails | AO › "TRUNCATE payments fails", "TRUNCATE audit_logs fails" (AQ001) |
| Story 3 sc.6: inserts still work | AO › "inserts a payment and an audit row" |
| FR-013: money is integer | data-model review (`bigint`); SD › "unit prices are bigint" |
| FR-024, SC-001: migrations on an empty DB | global setup (drop schema → `migrate deploy`) on every run; quickstart §1–§2 |
| FR-025, Story 4 sc.1: 2 companies × 1/1/2 users | SD › "creates 2 companies with 1 manager, 1 accountant, 2 sales reps each"; SU › same on the data |
| FR-026, Story 4 sc.2: ≥10 available units, ≥3 types, varied price/area | SD › "each company has ≥10 available units"; SU › "≥3 types, >1 price, >1 area, unique project+number" |
| FR-027, Story 4 sc.3: ≥3 clients per rep, same company, notes | SD › "each sales rep has ≥3 clients in the same company"; SU › "≥1 client with notes per rep" |
| FR-028, Story 4 sc.5: hashed passwords | SD › "every seed password hash starts with `$argon2id$` and verifies with the README password" |
| Story 4 sc.6: README lists accounts | README review against contracts/seed-accounts.md |
| FR-029, Story 4 sc.4, SC-005: seed twice | SD › "a second run changes no row count in any table" |
| Seed is all-or-nothing (makes the skip rule safe, R7) | SD › "a seed that fails midway leaves no rows": runs `runSeed(db, data)` with a copy of the seed data under fresh UUIDs and emails, whose last unit has price 0; expects 23514 `units_price_check`, then 0 rows for that copy's company, user, unit and client ids; then runs the same copy with the price fixed and expects it to seed fully (the failed run did not leave a company that would trigger the skip) |
| FR-030: no reservations etc. from seed | SD › "seed creates no reservations, contracts, installments, payments or audit rows for seed companies" |
| FR-023: rules owned by later phases | not tested here; listed in contracts/database.md with the owning phase |
| FR-031, SC-007: the required tests | AO (4 cases) + SC (paid > amount, second contract, cross-company reservation) |
| SC-006: log in with README accounts | phase 2 |

## Phase 0 global-setup change: effect on phase 0 tests

The change adds one step to `tests/integration/setup/global-setup.ts` (phase 0 task T035), between its
connection check (2) and `prisma migrate deploy` (3): with the same `pg` client, run
`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.

Checked against phase 0's tasks (the file is not written yet on `001-project-setup`, so it could not be run):

- The `_test` name guard (1) and the "not reachable" message (2) run first and are unchanged, so T037's
  "fails with a clear message when the DB is down" still holds, and the app database can never be dropped.
- `tests/integration/server/db.test.ts` (T036) checks `current_database() = 'aqar_test'` and a rolled-back
  `withTransaction`. Neither reads a table, so an empty, freshly migrated schema does not affect it.
- `tests/unit/architecture/import-rules.test.ts` case (12) only checks that this file may import `pg`. Unchanged.
- `migrate deploy` on an empty schema with no migrations (phase 0 state) prints "No pending migrations" and exits 0
  (phase 0 R3), so the step is safe even before this phase's migrations exist.
- The `aqar` role owns the `public` schema in the compose database, so it may drop and recreate it.

**Gate in implement**: after the change, run the full phase 0 suite (`npm run test` and `npm run test:integration`)
before writing any phase 1 test. If phase 0 is still in progress when this lands, the simpler path is to add the step
to T035 directly on `001-project-setup`.

## README "Not done": database roles (agreed 2026-11-12)

Text to add: the app connects as the table owner, which could disable the append-only triggers on purpose.
Fix with more time: a separate migration owner role (owns the tables, runs `prisma migrate deploy`) and a low-privilege app role (no ownership, so it cannot `ALTER TABLE … DISABLE TRIGGER`), with `UPDATE`, `DELETE` and `TRUNCATE` revoked on `payments` and `audit_logs`, and two database URLs: one for migrations, one for the app. Not built in this phase because it changes phase 0's compose file,
env validation and entrypoint.

## Complexity Tracking

No constitution violations.
