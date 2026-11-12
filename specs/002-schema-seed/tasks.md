---

description: "Task list for phase 1: database schema and seed"
---

# Tasks: Database Schema and Seed

**Input**: Design documents from `specs/002-schema-seed/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/database.md](./contracts/database.md), [contracts/seed-accounts.md](./contracts/seed-accounts.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The user's "done when" (spec FR-031) and constitution principle V need integration tests on a real Postgres. Every negative test asserts the SQLSTATE **and** the constraint name with `expectDbError`, and has a positive control (research R8).

**Organization**: The whole schema is one migration (`init_schema`, plan.md), and every story needs it, so it is built in Phase 2 (Foundational). User Stories 1 and 2 then prove it with tests. User Stories 3 and 4 are test-first: their tests fail until the triggers migration (US3) and the seed (US4) exist.

**Commits**: one small Conventional Commit per task or per closely related pair (AGENTS.md §9), with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 from spec.md

## Rules that apply to every task

- Import paths in `prisma/*.ts` end in `.ts` (`./run-seed.ts`, `../src/generated/prisma/client.ts`): the seed runs with Node 22 type stripping (research R7). Do not use TS `enum`, `namespace` or parameter properties in `prisma/*.ts`: type stripping cannot run them.
- Test files never import the generated Prisma client or Prisma error classes. They get the client from `@/server/db` (phase 0: `getDb()` / `withTransaction`) and read errors by shape (research R8).
- Money in the seed is written as halala `bigint` literals with a riyal comment, e.g. `45_000_000n // 450,000 SAR`. No riyal conversion outside `src/shared/lib/money.ts`.
- Never edit a migration after it is applied (AGENTS.md §5). Migrations are created with `--create-only`, edited, then applied.
- Raw SQL in tests uses the tagged template `$executeRaw\`…\`` / `$queryRaw\`…\`` with parameters, never string concatenation.

---

## Phase 1: Setup (Prerequisites)

**Purpose**: Make sure phase 0 exists on this branch before any phase 1 file changes.

- [x] T001 Confirm phase 0 (`001-project-setup`) is merged into `main` (`git log main --oneline | grep -i "phase 0\|project setup\|Docker stack"` and `test -f tests/integration/setup/global-setup.ts` on `main`). Then rebase this branch: `git rebase main`. If phase 0 is not merged, STOP and tell the user; do not continue.
- [x] T002 Install and start: `npm ci`, copy `.env.example` → `.env` if missing, `npm run db:generate`, `docker compose up -d db`. If the volume predates `aqar_test`, run `docker compose down -v` once (phase 0 README).
- [x] T003 Baseline: run `npm run lint && npm run typecheck && npm run test && npm run test:integration`. All must pass before any change. Record the result in the commit message of T005.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The full schema in one migration, the test-database reset, and the test helpers. Every user story depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Change `tests/integration/setup/global-setup.ts` (phase 0 file): between the connection check (step 2) and `prisma migrate deploy` (step 3), reuse the same `pg` client (or open one with the same `testDbUrl`) to run `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`, then close it. The `_test` name guard (step 1) and the "not reachable" message stay first and unchanged. Add a one-line comment: payments and audit rows are append-only, so each run starts from an empty schema (research R8).
- [x] T005 Gate: run the full phase 0 suite again (`npm run test && npm run test:integration`). It must pass exactly as in T003 (plan.md "Phase 0 global-setup change"). Commit T004 + T005 as `test: reset integration schema before each run`.
- [x] T006 Write the 4 enums and 10 models in `prisma/schema.prisma` exactly as in [data-model.md](./data-model.md) (it matches the spike schema in research):
  - ids `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`, except `Session.id String @id`;
  - money `BigInt`; `area`, `rooms`, `seq`, `installmentCount` `Int`; instants `DateTime @db.Timestamptz(3)`; `dueDate DateTime @db.Date`; `meta Json @default("{}")`;
  - snake_case via `@map` / `@@map` (tables: `companies`, `users`, `sessions`, `units`, `clients`, `reservations`, `contracts`, `installments`, `payments`, `audit_logs`);
  - `@@unique([companyId, id])` on User, Unit, Client, Reservation; composite relations `fields: [companyId, x], references: [companyId, id]` for client→salesRep, reservation→unit/client/salesRep, contract→reservation; Contract has both `reservationId @unique` and `@@unique([companyId, reservationId])` (research R1);
  - **every** `@relation` sets `onDelete: Restrict, onUpdate: Restrict`, including the optional AuditLog relations (research R2);
  - uniques and indexes from data-model.md: `units @@unique([companyId, projectName, number])`, `@@index([companyId, status])`; `clients @@index([companyId, salesRepId])`; `reservations @@index([unitId, expiresAt])`, `@@index([companyId, salesRepId])`; `installments @@unique([contractId, seq])`; `payments @@unique([contractId, idempotencyKey])`; `sessions @@index([userId])`; `audit_logs @@index([companyId, createdAt])`.
  Run `npx prisma validate`.
- [x] T007 Run `npx prisma migrate dev --name init_schema --create-only`. Append to the new `prisma/migrations/<timestamp>_init_schema/migration.sql`, under a `-- Integrity checks (raw SQL: Prisma cannot express CHECK constraints)` comment, every CHECK from [contracts/database.md](./contracts/database.md) with exactly those names:
  `sessions_id_hash_check` (`id ~ '^[0-9a-f]{64}$'`, research R4a), `users_email_normalized_check` (`email = lower(btrim(email)) AND email <> ''`), `units_price_check`, `units_area_check`, `units_rooms_check`, `units_project_name_check` and `units_number_check` (`= btrim(x) AND x <> ''`), `contracts_final_price_check`, `contracts_down_payment_check` (`down_payment >= 0 AND down_payment < final_price`), `contracts_installment_count_check`, `installments_seq_check`, `installments_amount_check`, `installments_paid_amount_check` (`paid_amount >= 0 AND paid_amount <= amount`), `payments_amount_check`, `payments_idempotency_key_check`, and
  `audit_logs_login_failed_email_check`: `CHECK ("action" <> 'LOGIN_FAILED' OR (coalesce("meta" ->> 'email', '') <> '' AND "meta" ->> 'email' = lower(btrim("meta" ->> 'email'))))` (research R4: the `coalesce` makes a missing email fail).
  Then add the index: `CREATE INDEX "audit_logs_login_failed_email_idx" ON "audit_logs" (("meta" ->> 'email'), "created_at") WHERE "action" = 'LOGIN_FAILED';`
- [x] T008 Apply and check: `npx prisma migrate dev` (applies `init_schema`, regenerates the client). Then quickstart §2 (`npx prisma migrate dev --name drift_check --create-only` must create nothing or an empty migration; delete any empty folder, never commit it) and quickstart §3 (`grep -riE 'cascade|set null' prisma/migrations` prints nothing). Check every constraint name in contracts/database.md appears in `migration.sql`. Commit T006–T008 as `feat: add database schema with integrity checks`.
- [x] T009 Create `tests/integration/support/db-fixtures.ts`:
  - `expectDbError(promise, { code, constraint? })`: awaits the promise, fails if it resolves; reads `error.meta.driverAdapterError.cause.originalCode` and `.originalMessage` by shape (narrow `unknown` with type guards, no `any`); asserts `code` equals it and, when given, that the message contains `constraint`.
  - Factories that insert one valid row each through the Prisma client from `@/server/db` with random UUIDs and unique emails (`crypto.randomUUID()`): `makeCompany()`, `makeUser(companyId, role?)`, `makeUnit(companyId, overrides?)`, `makeClient(companyId, salesRepId, overrides?)`, `makeReservation({ companyId, unitId, clientId, salesRepId })`, `makeContract(companyId, reservationId, overrides?)`, `makeInstallment(contractId, overrides?)`, `makePayment(contractId, overrides?)`. Defaults are valid (e.g. unit price `100_000_00n`, area 120, rooms 3).
  - `makeContractChain()`: company → sales rep → unit → client → reservation → contract; returns all ids.
  Commit as `test: add database fixtures for integration tests`.

**Checkpoint**: schema applied with no drift and no cascade; phase 0 suite still green; helpers ready.

---

## Phase 3: User Story 1 - Complete data model from an empty database (Priority: P1) 🎯 MVP

**Goal**: Every entity exists after migrations; references, roles, emails and company links are enforced.

**Independent Test**: `npm run test:integration` on a freshly reset `aqar_test` runs `tests/integration/prisma/schema-constraints.test.ts` › "data model" and "company links" green; quickstart §1.

### Tests for User Story 1

- [x] T010 [US1] Create `tests/integration/prisma/schema-constraints.test.ts` with a `describe("data model")` block (spec Story 1, FR-001–004, FR-014, FR-015, FR-022):
  - "creates a full company → contract → installment chain": `makeContractChain()` + one installment + one payment + one audit row; all inserts succeed (positive path through every table).
  - "rejects a user without a company" (`$executeRaw` insert with `company_id` NULL → 23502).
  - "rejects an unknown role" (`$executeRaw` with role `'ADMIN'` → 22P02).
  - "rejects a duplicate email" (23505 `users_email_key`) and "rejects a non-normalized email" (`' Ali@X.test'` → 23514 `users_email_normalized_check`); control: a lowercase email is accepted.
  - "rejects a unit for a missing company" (random company id → 23503).
  - "refuses to delete a unit that has a reservation" (`DELETE FROM units WHERE id = …` → 23001); control: deleting a unit with no reservation works.
  - "accepts two clients with the same phone".
  - "rejects a session id that is not a SHA-256 hex hash" (a 43-char base64url string → 23514 `sessions_id_hash_check`); control: `createHash("sha256").update(randomBytes(32)).digest("hex")` is accepted (FR-004).
- [x] T011 [US1] In the same file, add `describe("company links")` (FR-015a, Story 2 scenario 11; clarification Q3). Build company A and company B with `makeContractChain()`-style data, then assert 23503 with the FK name for: client of A with sales rep of B (`clients_company_id_sales_rep_id_fkey`); reservation of A with unit of B (`reservations_company_id_unit_id_fkey`); with client of B (`reservations_company_id_client_id_fkey`); with sales rep of B (`reservations_company_id_sales_rep_id_fkey`); contract of A with reservation of B (`contracts_company_id_reservation_id_fkey`). Control: the same inserts with A's own rows succeed.
- [x] T012 [US1] Run `npm run test:integration`; all US1 cases pass. Commit T010–T012 as `test: prove data model and company links in the database`.

**Checkpoint**: User Story 1 proven.

---

## Phase 4: User Story 2 - Database rejects invalid business data (Priority: P1)

**Goal**: Every CHECK and UNIQUE rule from spec Story 2 refuses bad data, with a valid control for each.

**Independent Test**: `tests/integration/prisma/schema-constraints.test.ts` › "business rules" green.

### Tests for User Story 2

- [x] T013 [US2] In `tests/integration/prisma/schema-constraints.test.ts`, add `describe("business rules")` (spec Story 2 scenarios 1–10, FR-012, FR-016–019). Each case asserts code + constraint name from [contracts/database.md](./contracts/database.md):
  - units: price 0 and −1 (`units_price_check`), area 0 (`units_area_check`), rooms −1 (`units_rooms_check`), number `"A-101 "` (`units_number_check`); duplicate project+number in one company (23505 `units_company_id_project_name_number_key`); control: same project+number in another company and in another project of the same company are accepted.
  - contracts: final price 0, down payment −1, down payment = final price, installment count 0 (each its own CHECK name); control: down payment 0 accepted; "rejects a second contract for the same reservation" (23505 `contracts_reservation_id_key`).
  - installments: "rejects paid amount above amount" (amount `1_000_000n`, paid `1_000_001n` → `installments_paid_amount_check`); control "accepts paid = amount"; amount 0 (`installments_amount_check`); paid −1; seq −1 (`installments_seq_check`); duplicate seq in one contract (23505 `installments_contract_id_seq_key`).
  - payments: amount 0 (`payments_amount_check`); empty key (`payments_idempotency_key_check`); repeated key on one contract (23505 `payments_contract_id_idempotency_key_key`); control: same key on another contract accepted.
  - audit: "rejects LOGIN_FAILED with a mixed-case email", "rejects LOGIN_FAILED without an email" (meta `{}`) (both `audit_logs_login_failed_email_check`); control "accepts LOGIN_FAILED with no company and no user" (meta `{"email":"x@y.test"}`).
- [x] T014 [US2] Run `npm run test:integration`; all pass. Commit T013–T014 as `test: prove business integrity checks in the database`.

**Checkpoint**: User Stories 1 and 2 proven. FR-031 items "paid above amount", "second contract" and "cross-company reservation" are covered.

---

## Phase 5: User Story 3 - Payments and audit log cannot be changed or deleted (Priority: P1)

**Goal**: UPDATE, DELETE and TRUNCATE on `payments` and `audit_logs` fail with SQLSTATE `AQ001`; INSERT still works.

**Independent Test**: `tests/integration/prisma/append-only.test.ts` green; quickstart §5 on `aqar_test`.

### Tests for User Story 3 (write first; they must FAIL before T016)

- [ ] T015 [US3] Create `tests/integration/prisma/append-only.test.ts` (spec Story 3, FR-020, FR-021, FR-031). In `beforeAll`, create one contract chain, one payment and one audit row (`PRICE_CHANGED`, `meta {"old":1,"new":2}`). Cases, each with direct SQL via `$executeRaw` and `expectDbError(…, { code: "AQ001" })`, then re-read the row with `$queryRaw` and assert every column is unchanged / the row still exists:
  - "UPDATE on a payment fails", "DELETE on a payment fails", "TRUNCATE payments fails";
  - "UPDATE on an audit row fails", "DELETE on an audit row fails", "TRUNCATE audit_logs fails";
  - "inserts a payment and an audit row" (positive control, Story 3 scenario 6).
  Run it: the UPDATE/DELETE/TRUNCATE cases fail now (no triggers yet). Commit as `test: add append-only tests for payments and audit log`.

### Implementation for User Story 3

- [ ] T016 [US3] Run `npx prisma migrate dev --name append_only_guards --create-only`. Fill `prisma/migrations/<timestamp>_append_only_guards/migration.sql` with: function `reject_append_only_change()` (`LANGUAGE plpgsql`, `RAISE EXCEPTION 'append-only table %: % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'AQ001'`), and triggers `payments_no_update_delete` (`BEFORE UPDATE OR DELETE … FOR EACH ROW`), `payments_no_truncate` (`BEFORE TRUNCATE … FOR EACH STATEMENT`), `audit_logs_no_update_delete`, `audit_logs_no_truncate` (research R5). Apply with `npx prisma migrate dev`, then repeat the drift check (quickstart §2).
- [ ] T017 [US3] Run `npm run test:integration`; T015 now passes and US1/US2 still pass. Run quickstart §5 by hand on `aqar_test`. Commit T016–T017 as `feat: make payments and audit log append-only`.

**Checkpoint**: all FR-031 database tests pass.

---

## Phase 6: User Story 4 - Repeatable seed with known accounts (Priority: P2)

**Goal**: An all-or-nothing, idempotent seed with 2 companies, 8 users, 24 units, 12 clients; accounts listed in the README.

**Independent Test**: `tests/unit/prisma/seed-data.test.ts` and `tests/integration/prisma/seed.test.ts` green; quickstart §4.

### Tests for User Story 4 (write first; they must FAIL before T020–T022)

- [ ] T018 [P] [US4] Create `tests/unit/prisma/seed-data.test.ts` (no DB) importing `SEED_DATA` and `SEED_PASSWORD` from `prisma/seed-data.ts`:
  - exactly 2 companies; per company exactly 1 `MANAGER`, 1 `ACCOUNTANT`, 2 `SALES` (FR-025);
  - the 8 emails, roles and companies equal [contracts/seed-accounts.md](./contracts/seed-accounts.md); every email is lowercase and trimmed; `SEED_PASSWORD === "AqarLite#2026"`;
  - per company ≥10 units, all `AVAILABLE`; ≥3 distinct types; >1 distinct price; >1 distinct area; every price, area > 0 and rooms ≥ 0; `(projectName, number)` unique per company; project names and numbers trimmed (FR-026);
  - every sales rep has ≥3 clients, each client's company equals its rep's company; ≥1 client with notes per rep (FR-027);
  - all ids are unique UUIDs; prices are `bigint`.
- [ ] T019 [P] [US4] Create `tests/integration/prisma/seed.test.ts` (seed assertions are scoped to seed ids/emails, because other test files share the database):
  - "creates 2 companies with 1 manager, 1 accountant, 2 sales reps each", "each company has ≥10 available units", "each sales rep has ≥3 clients in the same company" (call `runSeed(db)` once in `beforeAll`);
  - "every seed password hash starts with `$argon2id$` and verifies with the README password" (`verify` from `@node-rs/argon2`);
  - "seed creates no reservations, contracts, installments, payments or audit rows for seed companies" (FR-030);
  - "a second run changes no row count in any table": count all 10 tables, run `runSeed(db)` again, count again, expect equal (FR-029, SC-005);
  - "a seed that fails midway leaves no rows": build a copy of `SEED_DATA` with fresh UUIDs for every row and fresh emails, set the **last** unit's price to `0n`; `expectDbError(runSeed(db, copy), { code: "23514", constraint: "units_price_check" })`; then assert 0 rows exist for the copy's company, user, unit and client ids; then fix the price, run `runSeed(db, copy)` again and assert it seeds fully (plan.md proof map; proves the skip rule is safe).
  Run T018 and T019: both fail (no seed modules yet). Commit as `test: add seed data and seed behaviour tests`.

### Implementation for User Story 4

- [ ] T020 [US4] Create `prisma/seed-data.ts`: export `SEED_PASSWORD = "AqarLite#2026"` and `SEED_DATA` (plain readonly constants, fixed UUIDs, `import type` only from the generated client for `Role` / `UnitType`): 2 companies and 8 users exactly as [contracts/seed-accounts.md](./contracts/seed-accounts.md) (fictional Arabic names); per company 12 `AVAILABLE` units over 3 Arabic project names, all 4 types, areas 85–450 m², rooms 1–7, prices 450,000–3,200,000 SAR as halala `bigint` literals with riyal comments; 3 clients per sales rep with Arabic names, `05xxxxxxxx` phones, notes on at least one per rep. Run T018: it passes.
- [ ] T021 [US4] Create `prisma/run-seed.ts`: `export async function runSeed(db: PrismaClient, data = SEED_DATA): Promise<void>` (type-only import of `PrismaClient` from `../src/generated/prisma/client.ts`):
  1. if a company with `data.companies[0].id` exists → `process.stdout.write("Seed: seed data already present, skipping.\n")` and return;
  2. hash `SEED_PASSWORD` once per user with `hash()` from `@node-rs/argon2` (default Argon2id), **before** the transaction;
  3. in **one** `db.$transaction(async (tx) => …)`: `createMany` companies → users → units → clients, in that order (so a bad unit fails after companies and users were written, which the atomicity test relies on);
  4. print one summary line with the counts. No `console.log` (phase 0 lint).
- [ ] T022 [US4] Replace `prisma/seed.ts` (phase 0 placeholder): create `PrismaClient` with `new PrismaPg({ connectionString: process.env.DATABASE_URL })` (fail with a clear message if unset), `await runSeed(prisma)`, `await prisma.$disconnect()` in `finally`, exit code 1 on error with the message only. Imports end in `.ts`.
- [ ] T023 [US4] Run `npm run test && npm run test:integration` (T018, T019 green) and quickstart §4 against the app database (`npm run db:seed` twice; counts `2/8/24/12/0` both times). Commit T020–T023 as `feat: add idempotent seed with demo companies`.

**Checkpoint**: all four user stories proven.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T024 Update `README.md` (phase 0 file):
  - "Running": the seed accounts table and password from [contracts/seed-accounts.md](./contracts/seed-accounts.md) (Story 4 scenario 6, FR-028);
  - "Assumptions": area in whole m²; unit types apartment/villa/townhouse/duplex; the database refuses cross-company links (composite FKs) and services still filter by company; emails stored trimmed and lowercase; the seed runs in one transaction and skips when its first company exists; integration tests rebuild the `aqar_test` schema on every run;
  - "Not done": the app connects as the table owner, which could disable the append-only triggers on purpose; the fix is a separate migration owner role and a low-privilege app role, with `UPDATE`, `DELETE` and `TRUNCATE` revoked on `payments` and `audit_logs`, and two database URLs (one for migrations, one for the app) (plan.md, agreed 2026-11-12).
  Commit as `docs: document seed accounts and schema assumptions`.
- [ ] T025 Full stack check, quickstart §7: `docker compose down -v && docker compose up --build`; the app log shows both migrations applied and the seed run once; `docker compose restart app` shows the seed skipped.
- [ ] T026 Final gate: `npm run lint && npm run typecheck && npm run test && npm run test:integration` all pass. Re-run quickstart §1–§3. Fix anything that fails before continuing.
- [ ] T027 Run `/security-review` on the branch diff. Fix every open issue (commit each fix as `fix: …`).
- [ ] T028 Run the `interview-notes` skill for phase 1 (private notes; not committed unless the skill says so).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T003)**: no dependencies; T001 is a hard stop if phase 0 is not on `main`.
- **Foundational (T004–T009)**: needs Setup. T004 → T005 (gate). T006 → T007 → T008. T009 needs T008 (generated client types).
- **US1 (T010–T012)** and **US2 (T013–T014)**: need Foundational. Both edit `schema-constraints.test.ts`, so run them in order, not in parallel.
- **US3 (T015–T017)**: needs Foundational. Independent of US1/US2 (different file).
- **US4 (T018–T023)**: needs Foundational (tables). Independent of US1–US3.
- **Polish (T024–T028)**: needs all stories.

### User Story Dependencies

- US1, US2, US3, US4 each depend only on Phase 2. None depends on another story.
- Only shared file: `schema-constraints.test.ts` (US1 then US2).

### Within Each Story

- US3 and US4: tests first, run them and see them fail, then implement.
- US1 and US2: the rules are built in Foundational (one migration, plan.md), so their tests pass on first run. Each case asserts the constraint **name**, so it cannot pass because of a different error.

### Parallel Opportunities

- After Phase 2: US3 (T015–T017) and US4 (T018–T023) can run alongside US1/US2 (different files).
- Inside US4: T018 and T019 are [P] (different files).

---

## Parallel Example: User Story 4

```text
Task: "T018 [P] [US4] tests/unit/prisma/seed-data.test.ts"
Task: "T019 [P] [US4] tests/integration/prisma/seed.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (schema applied, phase 0 still green).
2. Phase 3 (US1). **STOP and validate**: the schema exists, links stay in one company, nothing cascades.

### Incremental Delivery

1. US2 → all business CHECKs proven.
2. US3 → append-only guaranteed (completes the user's "done when" with US1/US2).
3. US4 → seed and README accounts.
4. Polish → README, full stack, gates, security review.

### Time budget

Phase 1 budget is 1.5 h (docs/phases.md). If over by 30 minutes, finish US1–US3 (the "done when" items) and the smallest seed that passes T018/T019, and write the rest in README "Not done".
