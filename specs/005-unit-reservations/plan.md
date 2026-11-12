# Implementation Plan: Unit Reservations

**Branch**: `claude/unit-reservations-16e517` (spec folder `005-unit-reservations`) | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-unit-reservations/spec.md`

> **Blocked on phases 2 and 3.** This branch was cut from `main` (phase 1 only). Implementation starts only after phase 2 (`003-auth-app-shell`) and phase 3 (`004-unit-client-management`) are merged and this branch is rebased (constitution › Development Workflow). What this phase uses from them is listed in [research R12](./research.md#r12-dependencies-on-phases-2-and-3).

## Summary

Add the `reservations` feature.

- **Reserve**: a sales rep reserves an available unit for one of their own clients.
  - It runs in one transaction: release expired reservations, then one conditional `UPDATE … WHERE status = 'AVAILABLE'` on the unit, then insert the reservation with the DB clock (`now()`, `now() + 72 h`).
  - Under concurrent requests exactly one wins. The others get `UNIT_NOT_AVAILABLE` (409) with an Arabic message.
- **Expiry**: expiry stays lazy, with no cron. This phase **fixes phase 3's `releaseExpired`**, which loses to a concurrent reserve under READ COMMITTED (reproduced on Postgres 18; [research R2](./research.md#r2-fix-releaseexpired-for-concurrent-reserves-changes-phase-3-code)). It now locks the candidates, then re-checks them in a second statement.
- **No schema change**: a database-level overlap guard (an exclusion constraint) is recorded in README "Not done" ([R3](./research.md#r3-database-guard-against-overlapping-reservations-not-in-this-phase)).
- **Lists**: reps see their own active reservations and managers see the company's, soonest expiry first, with expiry in Saudi time and time left. The units list shows a reserved unit's expiry, but never its client or rep.
- **UI**: the units page opens a reserve dialog from `?reserve=<unitId>`. The page composes it into the units list as a slot (AGENTS §2, amended in `e3f19ed`).

The main proofs are service-level integration tests on real Postgres. One deterministic lock test proves the release fix, and two parallel tests run 10 times each.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 LTS

**Primary Dependencies**: as in phases 0–3: Next.js App Router (Route Handlers), React, TanStack Query, Zod, React Hook Form + `@hookform/resolvers`, Prisma + `@prisma/adapter-pg`, `date-fns` + `@date-fns/tz`, sonner, shadcn/`radix-ui`. **No new npm dependency.**
- The shadcn `dialog` primitive is added with the shadcn CLI if phases 2 and 3 did not add it. It is built on `radix-ui`, which phase 2 approved.

**Storage**: PostgreSQL 18.
- Tables: `reservations` (insert and read), `units` (status updates), `clients` and `users` (read), `contracts` (read, for "active").
- No migration.

**Testing**: Vitest. Unit tests in `tests/unit` (no DB). Integration tests in `tests/integration` on the real test database, rebuilt every run.

**Target Platform**: Linux container (`docker compose up`); mobile and desktop browsers

**Project Type**: Web application (one Next.js project, feature folders)

**Performance Goals**:
- A reserve call is 4–5 statements in one transaction.
- List pages answer well under 1 s with the seed data.
- The release locks only the units whose reservation expired, which is a handful.

**Constraints**:
- Isolation level READ COMMITTED (the default; R2 depends on it).
- One clock: the DB's `now()` (R4).
- `companyId` comes only from the session.
- Page size max 50.
- No Server Actions.
- Logical RTL classes only.

**Scale/Scope**:
- 1 new feature.
- 3 API handlers in 2 route files.
- 1 page; 1 changed page (units).
- About 6 new test files and 3 changed ones.

## Constitution Check

*Gate before research: PASS. Re-checked after design: PASS.*

| # | Principle | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| I | Tenant Isolation | PASS | `companyId` and `userId` come only from `SessionUser`. Every new repository function takes `companyId` first. The unit update, the client lookup and the list all filter by it. Phase 1's composite FKs refuse cross-company links. Another company's unit or client → 404. Proven by `reservations.service.test.ts` › "tenant isolation › …". |
| II | Server-Side Authorization | PASS | The role is checked in the service: reserve and options are SALES only, the list refuses ACCOUNTANT. Ownership: the client lookup is scoped by `salesRepId`, and the list is scoped by `salesRepId` for SALES. `reserveInputSchema` is a `.pick()` of `unitId` and `clientId` only. Proven by "role checks", "ownership", "ignores hand-sent fields". |
| III | Financial Accuracy | PASS (n/a) | No money is written. `UnitDto.price` is unchanged (integer halalas). Dates are shown in `Asia/Riyadh` with `date-fns` + `@date-fns/tz`. |
| IV | Atomic and Concurrency-Safe | PASS | Reserve is one transaction with a conditional update (agreed). The concurrency test uses `Promise.all` on real Postgres (agreed), plus a just-expired variant and a deterministic release-vs-reserve test. The release fix (R2) keeps the RESERVED → AVAILABLE transition correct under concurrency. Allowed transitions only. |
| V | Database-Enforced Integrity | PASS | Phase 1's composite FKs keep every reservation inside one company. The "one active reservation per unit" rule is enforced by the database's row lock on the conditional `UPDATE … WHERE status = 'AVAILABLE'` (proven by R10's tests). A second guard (an exclusion constraint) was left out by the user's decision and is recorded in README "Not done" (R3). No delete or update code for reservations, and no schema change. |
| VI | Layered Architecture | PASS | `route.ts` → `reservations.routes.ts` → `reservations.service.ts` → `reservations.repository.ts`. Units and clients are used only through their `server/index.ts`, in the allowed direction (reservations → units, clients). Units never imports reservations: it reads the `reservations` table only inside its own repository (R6). No client component imports another feature (R7). Strict TS, no `any`. |
| VII | Security by Default | PASS | Zod on the body and every query param. Raw SQL only as tagged templates. Generic Arabic errors, including one 409 message for every "not available" case. No secrets. No audit rows are required for reservations (spec Assumptions). |
| VIII | Scope Discipline | PASS | No cancel, no history page, no per-rep cap, no picker search (README "Not done"). No new npm dependency. Assumptions are recorded in the README. |

## Departures and clarifications

All four agreed decisions are kept:
- lazy expiry with `releaseExpired()` first, no cron;
- reserve in one transaction with the conditional update, 0 rows → `UNIT_NOT_AVAILABLE`, then the insert with expiry = now + 72 hours;
- client ownership checked before reserving;
- the `Promise.all` concurrency test on real Postgres.

These points add to or refine them:

1. **Phase 3's `releaseExpired` body changes** (R2): it now runs two statements in one transaction: lock the candidates in id order, then a re-checked update. Its signature (`companyId, tx?`) and its return value (the count) stay the same, so phase 3's callers and tests do not change.
   - **Why**: the single-statement version can free a unit that a concurrent transaction has just reserved, leaving two active reservations. This was reproduced on Postgres 18.
   - The agreed call order (release first, then reserve) is unchanged.
2. **0 rows → 404 or 409** (R1; approved 2026-11-12): after a 0-row update, the service re-reads the unit inside the transaction. A unit missing from the session company → `NOT_FOUND`. Otherwise → `UNIT_NOT_AVAILABLE`.
   - **Why**: spec FR-007 requires 404 for another company's unit.
3. **Transaction rules** (R2; approved 2026-11-12):
   - Lock order: release first, then lock or update any unit or contract row. Phase 5 approval follows this too.
   - No nested transactions: inside `withTransaction`, call only repository functions that take `tx`, never another service.
4. **Expiry from the DB clock** (R4): `expires_at = now() + 72 hours` is computed by Postgres, the same clock `releaseExpired` uses. It is not computed in JS.
5. **No database overlap guard** (R3; user decision 2026-11-12): no schema change. The exclusion-constraint design goes to README "Not done".

## Project Structure

### Documentation (this feature)

```text
specs/005-unit-reservations/
├── spec.md
├── plan.md                # this file
├── research.md            # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   └── reservations-api.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks (not created here)
```

### Source Code: every file created or changed

Legend: **new**, **change**.
- **P3** = a phase 3 file changed by this phase. Its path is as planned in phase 3 and is checked after the rebase.
- `<timestamp>` is set by `prisma migrate dev --create-only`.
- `src/app/(app)/` is phase 2's authenticated route group. Phase 3's pages live in it.

```text
# Database
(no schema change; R3)

# Server infrastructure
src/server/http/error-codes.ts            change  + UNIT_NOT_AVAILABLE: 409

# Shared
src/shared/lib/error-messages.ts          change  + UNIT_NOT_AVAILABLE: "هذه الوحدة لم تعد متاحة، فقد حُجزت للتو. اختر وحدة أخرى."
src/shared/lib/dates.ts                   new     formatRiyadhDateTime(iso), formatTimeLeft(expiresAt, asOf) (R11)
src/shared/lib/navigation.ts              change  + { href: "/reservations", label: "الحجوزات", roles: [MANAGER, SALES] }
src/shared/components/ui/dialog.tsx       new*    shadcn CLI (*only if phases 2–3 did not add it)

# Units feature (phase 3 files changed by this phase)
src/features/units/units.types.ts                      P3 change  UnitDto + reservedUntil: string | null
src/features/units/server/units.repository.ts          P3 change  releaseExpired(companyId, tx?) body → lock-then-recheck in one transaction, same signature and return (R2); + dbNow(tx?); findUnits/findUnit select active reservation expiresAt (R6); + reserveUnitIfAvailable(companyId, unitId, tx), findUnitStatus(companyId, unitId, tx) (R1)
src/features/units/server/units.service.ts             P3 change  listUnits/getUnit pass dbNow() to the reads; mapper adds reservedUntil
src/features/units/server/index.ts                     P3 change  + reserveUnitIfAvailable, findUnitStatus exports (releaseExpired, getUnit already exported)
src/features/units/client/units-page/units-page.tsx    P3 change  + prop reserveDialog?: ReactNode, rendered once; passes onReserve to the table
src/features/units/client/units-page/use-units-page.ts P3 change  + openReserve(unitId): router.replace with ?reserve=<id>, other params kept
src/features/units/client/units-page/types.ts          P3 new?    UnitsPageProps (only if phase 3 has no types.ts there)
src/features/units/client/units-page/components/units-table/units-table.tsx  P3 change  "حجز" button for SALES on AVAILABLE rows; reserved rows show "حتى <date>" from reservedUntil

# Reservations feature (new)
src/features/reservations/reservations.schemas.ts       new  reservationSchema; reserveInputSchema (.pick unitId, clientId); reservationListQuerySchema (paginationFields); reserveOptionsQuerySchema
src/features/reservations/reservations.types.ts         new  ReservationDto, ReservationPage, ReserveOptionsDto, ReserveInput, ReservationListQuery
src/features/reservations/reservations.keys.ts          new  reservationKeys.all / list(query) / options(unitId)
src/features/reservations/domain/reservation-window.ts  new  RESERVATION_HOURS = 72
src/features/reservations/server/reservations.repository.ts  new  dbNow(tx); insertReservation(companyId, {unitId, clientId, salesRepId}, tx) via $queryRaw with now() and make_interval(hours => RESERVATION_HOURS) RETURNING; findActiveReservations / countActiveReservations(companyId, {salesRepId?, now, skip, take}, tx)
src/features/reservations/server/reservations.service.ts     new  reserveUnit, listActiveReservations, getReserveOptions (+ DTO mapper)
src/features/reservations/server/reservations.routes.ts      new  reserveHandler (POST), listReservationsHandler (GET), reserveOptionsHandler (GET)
src/features/reservations/server/index.ts                    new  public API: route handlers, listActiveReservations (phase 5 will add what it needs)
src/features/reservations/client/reservations.queries.ts     new  reservationListOptions(query), reserveOptionsOptions(unitId) via queryOptions(); reserve fetcher
src/features/reservations/client/reservations-page/reservations-page.tsx      new  useQuery(keepPreviousData); loading / empty / error; PaginationNav
src/features/reservations/client/reservations-page/use-reservations-page.ts   new  URL ⇄ page
src/features/reservations/client/reservations-page/index.ts                   new
src/features/reservations/client/reservations-page/components/reservations-table/reservations-table.tsx  new  unit, client, rep (MANAGER only), expiry (Riyadh), time left vs asOf
src/features/reservations/client/reservations-page/components/reservations-table/index.ts                new
src/features/reservations/client/reserve-unit-dialog/reserve-unit-dialog.tsx   new  reads ?reserve; states per contracts/reservations-api.md "UI contract"
src/features/reservations/client/reserve-unit-dialog/use-reserve-unit-dialog.ts new  URL param ⇄ open; useQuery(options); RHF + zodResolver(reserveInputSchema) with unitId from URL; useMutation; applyApiError; invalidate reservationKeys.all + unitsQueryKey; toast; router.replace without reserve
src/features/reservations/client/reserve-unit-dialog/types.ts                   new  ReserveUnitDialogProps { unitsQueryKey: readonly unknown[] }
src/features/reservations/client/reserve-unit-dialog/index.ts                   new

# Routing
src/app/(app)/units/page.tsx              P3 change  renders <UnitsPage reserveDialog={user.role === "SALES" ? <ReserveUnitDialog unitsQueryKey={unitKeys.all} /> : null} />
src/app/(app)/reservations/page.tsx       new  requireUser → ACCOUNTANT → redirect("/") → parse searchParams (reservationListQuerySchema) → prefetchQuery(reservationKeys.list(query), listActiveReservations) → HydrationBoundary → <ReservationsPage>
src/app/api/reservations/route.ts         new  export { GET, POST } from reservations.routes
src/app/api/reservations/options/route.ts new  export { GET }

# Tests
tests/unit/features/reservations/reservations.schemas.test.ts                   new
tests/unit/shared/lib/dates.test.ts                                             new
tests/unit/shared/lib/navigation.test.ts                                        change  reservations item: MANAGER + SALES, not ACCOUNTANT
tests/integration/features/reservations/server/reservations.repository.test.ts  new     "active" boundary at exactly now
tests/integration/features/units/server/release-expired.test.ts                 new     R2 deterministic race + boundary (phase 3's units.repository.test.ts stays unchanged)
tests/integration/support/pg-locks.ts                                           new     waitForLockWait(match, timeoutMs): polls pg_stat_activity for wait_event_type = 'Lock'
tests/integration/features/reservations/server/reservations.service.test.ts     new
tests/integration/features/reservations/server/reservations.routes.test.ts      new     (phase 2 http + session helpers)
tests/integration/features/units/server/units.service.test.ts                   P3 change  reservedUntil; release runs in the read transaction

# Docs
README.md        change  Assumptions (spec), Technical decisions (R1, R2, R4, R7), "Not done" (manual cancel; per-rep cap; client search in the picker; exclusion constraint as a second DB guard against overlapping reservations, R3), Security note on R2
```

**Structure Decision**: the AGENTS.md feature layout.
- `src/features/reservations` holds `reservations.schemas.ts`, `reservations.types.ts`, `reservations.keys.ts`, `domain/`, `server/` (routes → service → repository, plus `index.ts`) and `client/` (one folder per component, private children under `components/`).
- The dialog is composed into the units page by `src/app/(app)/units/page.tsx` (amended AGENTS §2).
- Tests mirror `src/`.

### Service flows (the only places with business rules)

- **`reserveUnit(user, input)`**:
  1. Not SALES → `FORBIDDEN`.
  2. `getClient(user, input.clientId)` → `NOT_FOUND` if it is not the rep's own.
  3. `withTransaction`: `releaseExpired` → `reserveUnitIfAvailable` → 0 rows: `findUnitStatus` (none → `NOT_FOUND`, else `UNIT_NOT_AVAILABLE`) → `insertReservation` → DTO.
  ([R1](./research.md#r1-the-reserve-transaction))
- **`listActiveReservations(user, query)`**:
  1. ACCOUNTANT → `FORBIDDEN`.
  2. `withTransaction`: `releaseExpired` → `now = dbNow(tx)` → find + count (SALES: `salesRepId = userId`) → `{ …page, asOf }`. ([R5](./research.md#r5-active-and-the-reservations-list))
- **`getReserveOptions(user, unitId)`**:
  1. Not SALES → `FORBIDDEN`.
  2. `getUnit(user, unitId)`: phase 3's own release-and-read transaction; 404 for another company.
  3. `listClients(user, { page: 1, pageSize: 50 })` → `{ unit, clients }`.
  4. **No outer transaction**: services never nest (R2, "No nested transactions"). ([R8](./research.md#r8-data-for-the-dialog-get-apireservationsoptionsunitid))

The route handlers only parse (body: `readJson` + `reserveInputSchema`; query: `toQueryInput` + schema), call the service and return `{ data }` (201 for POST).

### UI states (FR-019 – FR-024)

- **Reservations page**:
  - `isPending` → `TableSkeleton`;
  - `isFetching && isPlaceholderData` → dimmed table;
  - empty → `EmptyState` with "لا توجد حجوزات نشطة" and a link to `/units`;
  - `isError` → `ErrorState` with retry.
- **Reserve dialog**: every state in [contracts › UI contract](./contracts/reservations-api.md#ui-contract-reserve-dialog). The submit button is disabled and shows a spinner while pending (FR-020).
- **Units table**: "حجز" appears only when `role === "SALES" && status === "AVAILABLE"` (FR-019). A RESERVED row shows `formatRiyadhDateTime(reservedUntil)` (FR-019a).
- **Navigation**: "الحجوزات" for MANAGER and SALES (FR-023).

## Requirement → proof map

"Auto" = an automated test. "Manual" = a step in [quickstart.md](./quickstart.md). Test names are the `it(...)` titles to use.
- `svc` = `tests/integration/features/reservations/server/reservations.service.test.ts`
- `routes` = `tests/integration/features/reservations/server/reservations.routes.test.ts`

| Rule | Proof | Kind |
|---|---|---|
| FR-001 only SALES reserve (403) | `svc` › "role checks › MANAGER cannot reserve", "role checks › ACCOUNTANT cannot reserve" (both: unit still AVAILABLE, 0 rows); `routes` › "POST as accountant → 403" | Auto |
| FR-002 rep reserves available unit for own client | `svc` › "reserve › rep reserves an available unit for own client" (DTO, unit RESERVED, row salesRepId = rep) | Auto |
| FR-003 exactly 72 h, server-set fields | `svc` › "reserve › expiresAt − 72 h lies between the DB times read just before and just after the call", "reserve › ignores hand-sent expiresAt, salesRepId, companyId, status" (input parsed through `reserveInputSchema` with extra keys); `tests/unit/features/reservations/reservations.schemas.test.ts` › "strips expiresAt, salesRepId, companyId, status" | Auto |
| FR-004 one active per unit; RESERVED/SOLD → 409 | `svc` › "conflict › reserved unit → UNIT_NOT_AVAILABLE, nothing changes", "conflict › sold unit → UNIT_NOT_AVAILABLE"; `routes` › "409 body has code UNIT_NOT_AVAILABLE and the Arabic message" | Auto |
| FR-005 concurrent → exactly one (user "done when" 1; SC-001) | `svc` › "concurrency › two reps, one available unit: exactly one wins" (`Promise.allSettled`, ×10: 1 fulfilled, 1 `UNIT_NOT_AVAILABLE`, 1 row, unit RESERVED for the winner's client); `routes` › "two parallel POSTs from two rep sessions: one 201, one 409" (through the route wrapper; constitution IV "real parallel requests") | Auto |
| R2 release never frees a just-reserved unit | `svc` › "concurrency › two reps, one just-expired unit: exactly one wins" (×10); `tests/integration/features/units/server/release-expired.test.ts` › "release during an open reserve never frees the unit" (deterministic, R10.3, fails on phase 3's single statement) | Auto |
| FR-006 not for another rep's client (user "done when" 3) | `svc` › "ownership › rep cannot reserve for another rep's client" (NOT_FOUND, 0 reservations, unit AVAILABLE); `routes` › "POST with another rep's client → 404" | Auto |
| FR-007 other company → 404 | `svc` › "tenant isolation › unit of company B → NOT_FOUND, B's unit unchanged", "tenant isolation › client of company B → NOT_FOUND" | Auto |
| FR-008 all-or-nothing | every refusal test (403, 404, 409, 400) asserts the unit's status and the reservation count are unchanged; the unit update and the insert share one `withTransaction` (R1) | Auto |
| FR-009 validation 400 + field errors | `reservations.schemas.test.ts` › "rejects missing / non-UUID unitId and clientId"; `routes` › "400 with fieldErrors.unitId and fieldErrors.clientId" | Auto |
| FR-010 active = future expiry and no approved contract | `svc` › "list › excludes expired", "list › excludes a reservation whose contract is approved", "list › includes one with a draft contract" (contract rows from `makeContract`); `tests/integration/features/reservations/server/reservations.repository.test.ts` › "findActiveReservations excludes a row whose expiresAt equals now" (passes `now` = the fixture's `expiresAt`); `release-expired.test.ts` › "releaseExpired frees a unit whose expiresAt equals the transaction now" (in one test transaction: read `now()`, set the fixture's `expiresAt` to it, call `releaseExpired(companyId, tx)`) | Auto |
| FR-011 expired → unit available, no manual action (user "done when" 2; SC-003) | `svc` › "expiry › expired reservation frees the unit and another rep can reserve it" (fixture `expiresAt` in the past → `listUnits` shows AVAILABLE → rep2 `reserveUnit` succeeds); `units.service.test.ts` (P3) › existing "expiry › …" tests still pass with the new release | Auto |
| FR-012 sold never returns | `units.service.test.ts` (P3) › "expiry › SOLD with expired reservation stays SOLD" (kept) | Auto |
| FR-013 expired kept as history | `svc` › "expiry › the expired reservation row still exists after the unit is re-reserved" | Auto |
| FR-014 no cancel / extend | `routes` › "route modules export no DELETE, PATCH or PUT" (`Object.keys` of `src/app/api/reservations/route.ts` is exactly `["GET", "POST"]`, and of `options/route.ts` exactly `["GET"]`; route tests call handlers directly, so Next's 405 cannot be observed) | Auto |
| FR-015 rep own / manager company / accountant 403 | `svc` › "list › rep sees only own", "list › manager sees all reps of the company", "role checks › ACCOUNTANT cannot list"; `routes` › "GET as accountant → 403" | Auto |
| FR-016 fields shown; Riyadh time | `svc` › "list › DTO has unit, client, salesRep, expiresAt"; `tests/unit/shared/lib/dates.test.ts` › "formats 2026-11-12T21:30Z as 2026/11/13 00:30 (Riyadh)", "time left 71 h 59 m", "less than a minute" | Auto |
| FR-017 paging, order, 400 | `svc` › "list › soonest expiry first, id breaks ties, pages never repeat or skip"; `reservations.schemas.test.ts` › "pageSize 51 → error", "defaults 1 / 20" | Auto |
| FR-018 no other company in any list (SC-005) | `svc` › "tenant isolation › manager of A never sees B's reservations", "tenant isolation › rep of A never sees B's reservations" | Auto |
| FR-019 reserve action: SALES, AVAILABLE rows, own clients, no-clients message | `svc` › "options › clients are only the rep's own", "options › MANAGER and ACCOUNTANT → FORBIDDEN", "options › unit of company B → NOT_FOUND", "options › answers within 2 s while another unit of the company has an expired reservation" (guards against the nested-transaction deadlock, R2); quickstart §2 | Auto + Manual |
| FR-019a units list shows expiry, never client/rep | `units.service.test.ts` (P3) › "list › reserved unit has reservedUntil = active expiry", "list › available unit has reservedUntil null", "list › DTO has no client or salesRep key"; quickstart §2 | Auto + Manual |
| FR-020 loading, no double submit, 409 at top, status refresh | quickstart §3; `tests/unit/shared/lib/form-errors.test.ts` (P3) › "maps 409 to root" (reused) | Manual + Auto |
| FR-021 lists update without reload | quickstart §2 (invalidation) | Manual |
| FR-022 loading / empty / error | quickstart §5 | Manual |
| FR-023 nav for MANAGER + SALES | `tests/unit/shared/lib/navigation.test.ts` › "reservations item for MANAGER and SALES, not ACCOUNTANT" | Auto |
| FR-024 Arabic RTL, mobile + desktop | quickstart §7 | Manual |
| FR-025 the test list | all rows above marked Auto; `routes` covers status codes over HTTP | Auto |
| R4 one clock | covered by FR-003 (`expiresAt` from the DB's `now()`) | Auto |

## Complexity Tracking

No constitution violations, so nothing to justify. The page-level composition of the dialog follows AGENTS §2 as amended in commit `e3f19ed`.
