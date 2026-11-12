# Research: Unit Reservations

Each decision lists what was chosen, why, and what was rejected. "Phase 3" means the plan in `specs/004-unit-client-management` (branch `claude/unit-client-management-5ac1e8`); "phase 2" means `specs/003-auth-app-shell`.

## R1. The reserve transaction

**Decision**: `reserveUnit(user, input)` in `reservations.service.ts`:

1. `user.role !== "SALES"` → `FORBIDDEN` (403). Reserve is a create, so the role is checked first (phase 3 R3).
2. Client ownership: `getClient(user, input.clientId)` from `clients/server/index.ts`. For a sales rep it is scoped by `companyId` and `salesRepId`, so another rep's client, another company's client and a missing client all give `NOT_FOUND` (404). A client's owner never changes, so this check can run before the transaction.
3. `withTransaction(async (tx) => …)`:
   1. `releaseExpired(user.companyId, tx)` from `units/server/index.ts` (agreed: lazy expiry, release first). See R2 for the fixed version.
   2. `reserveUnitIfAvailable(user.companyId, input.unitId, tx)` from the units feature: one conditional update `WHERE id = $unitId AND company_id = $companyId AND status = 'AVAILABLE'` that sets `RESERVED` (agreed).
   3. 0 rows → `findUnitStatus(companyId, unitId, tx)`. No row → `NOT_FOUND` (404, another company or missing). A row → `UNIT_NOT_AVAILABLE` (409).
   4. 1 row → `insertReservation(...)` with the DB clock (R4). Return the new reservation.
4. A `23P01` exclusion violation (R3) caught outside the transaction → `UNIT_NOT_AVAILABLE` (409). It can only happen if the code above has a bug.

**Rationale**:
- The conditional update takes the row lock. Under READ COMMITTED, a second reserve on the same unit waits, then re-checks `status = 'AVAILABLE'` on the committed row and matches 0 rows. Exactly one wins (FR-005).
- Step 3.3 resolves a conflict in the inputs. The agreed note says "0 rows → 409", but spec FR-007 and Story 1 scenario 6 say another company's unit is 404. Re-reading the unit inside the same transaction tells the two cases apart. Phase 3 R1 uses the same pattern for price edits. This is a clarification of the agreed note, not a change: every 0-row case for a unit of the user's company is still `UNIT_NOT_AVAILABLE`.
- Both the unit update and the insert run in one transaction, so a refused or failed request leaves the unit unchanged (FR-008).

**Alternatives considered**:
- `SELECT … FOR UPDATE`, then a status check, then an update. This is correct but needs an extra statement. The conditional update already gives the same guarantee.
- Insert the reservation first and rely on the DB guard alone. Rejected: the unit status would still need a separate update, and the agreed design is the conditional update.

## R2. Fix `releaseExpired` for concurrent reserves (changes phase 3 code)

**Problem**: Phase 3 R2 releases with one statement:

```sql
UPDATE units u SET status = 'AVAILABLE'
WHERE u.company_id = $1 AND u.status = 'RESERVED'
  AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now())
```

Under READ COMMITTED, when this statement waits on a unit row locked by a concurrent reserve, Postgres re-checks the `WHERE` against the **new version of the unit row only**. The `NOT EXISTS` subquery still reads the statement's **old snapshot**, so it does not see the reservation the other transaction just inserted. This is documented Postgres behaviour (the EvalPlanQual re-check), and it matters for this feature in two ways:

- A units-list read running while a rep reserves a unit whose old reservation expired flips the unit back to `AVAILABLE`, although it now has an active reservation. A second rep can then reserve it: two active reservations for one unit.
- Two reps racing for a just-expired unit hit the same path inside their own reserve transactions.

**Evidence**: reproduced on `postgres:18-alpine` (PostgreSQL 18.6) in a scratch database:
- Session A releases, reserves and inserts a reservation, then holds the transaction open.
- Session B runs the phase 3 statement and blocks on the lock.
- A commits.
- Result: `unit=AVAILABLE active=1`. With the fix below: `unit=RESERVED active=1`.

**Decision**: `releaseExpired(companyId, tx)` runs two statements inside the caller's transaction. `tx` becomes **required**.

1. Lock the candidates, in a fixed order:
   ```sql
   SELECT u.id FROM units u
   WHERE u.company_id = $1 AND u.status = 'RESERVED'
     AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now())
   ORDER BY u.id FOR UPDATE
   ```
2. If there are any ids, update them, repeating the full condition:
   ```sql
   UPDATE units u SET status = 'AVAILABLE'
   WHERE u.id = ANY($ids) AND u.company_id = $1 AND u.status = 'RESERVED'
     AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now())
   ```

Statement 1 waits for any in-flight reserve on those units to finish and then holds their locks. Statement 2 is a new statement, so under READ COMMITTED it gets a **fresh snapshot** that sees the committed reservation, and it does not release that unit. No other transaction can change the locked rows between the two statements.

Both statements are `$queryRaw`/`$executeRaw` tagged templates with bound parameters (constitution VII). If the adapter binds the id as `text`, add `::uuid` (phase 3 R2 note).

**Changes to phase 3 code**:
- `units.repository.ts › releaseExpired`: two statements; `tx` required.
- `units.service.ts › listUnits` and `getUnit`: run the release and the read in one `withTransaction`. `updateUnit` already has one.

**Conditions this relies on (written in the README "Technical decisions")**:
- The isolation level is READ COMMITTED, which is the Postgres and Prisma default. Under REPEATABLE READ, statement 2 would reuse the transaction's first snapshot and the fix would not work.
- **Lock order**: any transaction that calls `releaseExpired` does so **before** it locks or updates a unit row. In this phase that is reserve; in phase 3 it is the price edit. Phase 5 approval must follow the same rule: release first, then lock the contract or unit. If it did the opposite, two transactions could wait on each other.
- `now()` is the transaction's start time, so both statements and the reserve insert use one clock (R4).

**Alternatives considered**:
- Keep the single statement. Rejected: it is wrong under concurrency (evidence above).
- `FOR UPDATE SKIP LOCKED` in a subquery. Rejected: it still loses when the reserve commits before the release tries to lock the row. The lock is taken by following the update chain, and the `NOT EXISTS` still reads the old snapshot.
- SERIALIZABLE isolation with retries. Rejected: every unit read would need a retry loop, which adds a lot of moving parts for one rule.
- A per-company advisory lock taken by every release and every reserve. Correct, but it makes every units-list read in a company wait for every other one.
- Store the active expiry on the unit row, so the re-check is row-local. Rejected: it duplicates `reservations.expires_at` in a second place (phase 1: "anything that can be computed is not stored").

## R3. Database guard: no two overlapping reservations for one unit (schema change)

**Decision**: one new migration, `<timestamp>_reservation_overlap_guard`:

1. `CREATE EXTENSION IF NOT EXISTS btree_gist;`
2. Add `reserved_at timestamptz(3) NOT NULL DEFAULT now()`. Backfill existing rows with `expires_at - interval '72 hours'` before setting `NOT NULL`. The seed has no reservations, so normally there is nothing to backfill.
3. `CHECK (expires_at > reserved_at)`.
4. `EXCLUDE USING gist (unit_id WITH =, tstzrange(reserved_at, expires_at) WITH &&)`, named `reservations_no_overlap`.

`prisma/schema.prisma` gains `reservedAt DateTime @default(now()) @map("reserved_at") @db.Timestamptz(3)`. The extension, the check and the exclusion constraint are raw SQL in the migration file, like the phase 1 triggers (AGENTS §5).

**Why a schema change**:
- Constitution V says integrity rules live in the database too.
- "A unit can have at most one active reservation" is the core integrity rule of this phase, and R2 shows how easily code alone can get it wrong.
- A partial unique index cannot express it, because "active" depends on `now()`, and index predicates must be immutable.
- An exclusion constraint on the time window can express it. Two reservations for one unit can never cover the same moment, so at most one is active at any time.
- A range computed only from `expires_at` (`expires_at - interval '72 hours'`) is not allowed in an index: `timestamptz - interval` is STABLE, not IMMUTABLE. That is why the start time is stored. `reserved_at` also records when the reservation was made.

**Evidence**: tested on `postgres:18-alpine`:
- `btree_gist` 1.8 is available.
- An expired reservation followed by a new one for the same unit is accepted.
- A second overlapping one is refused with SQLSTATE `23P01`.

**Mapping**: `src/server/db.ts` gains `isExclusionViolation(err, constraint)`, next to phase 3's `isUniqueViolation`. The reserve service maps `reservations_no_overlap` to `UNIT_NOT_AVAILABLE`.

**Checks during implementation (fallback if any fails)**:
- After the migration, `prisma migrate dev --create-only` must produce an empty migration, so Prisma does not try to drop the constraint's index.
- The integration-test database reset must recreate the extension (the migration uses `IF NOT EXISTS`).
- If either fails and cannot be fixed in 15 minutes, drop steps 1, 3 and 4 and keep only the code guard. Write the guard into the README "Not done" with this design.

**Test fixtures**: `makeReservation` in `tests/integration/support/db-fixtures.ts` must set `reservedAt = expiresAt − 72 h`. Otherwise a fixture with a past `expiresAt` breaks the new check. Tests must never create two overlapping reservations for one unit.

**Alternatives considered**: code only (rejected, see above); a trigger that counts active reservations (it reads `now()` and has the same snapshot problem as R2).

## R4. One clock: the database's `now()`

**Decision**:
- The reservation is inserted with `$queryRaw`: `INSERT … (reserved_at, expires_at) VALUES (now(), now() + make_interval(hours => ${RESERVATION_HOURS}))` `RETURNING …`.
- `RESERVATION_HOURS = 72` lives in `src/features/reservations/domain/reservation-window.ts`.
- List reads get the DB time once with `SELECT now()` (`dbNow(tx)` in the reservations repository). They pass it to the "active" filter and return it as `asOf`.

**Rationale**:
- `releaseExpired` compares with the DB's `now()`. If expiry were computed in JS, a small clock difference between app and DB could make a reservation look active to one and expired to the other.
- Inside one transaction `now()` is fixed, so `expires_at − reserved_at` is exactly 72 hours (SC-002, asserted directly).

**Alternatives considered**: `new Date()` plus `addHours` in the service. It is simpler, but it uses two clocks.

## R5. "Active" and the reservations list

**Decision**:
- Active = `expires_at > now()` AND (no contract, or the contract's `approved_at IS NULL`) (FR-010). Phase 5 needs no change to keep the list right.
- `listActiveReservations(user, query)`:
  1. `ACCOUNTANT` → `FORBIDDEN` (403).
  2. `withTransaction`: `releaseExpired(companyId, tx)`, then `now = dbNow(tx)`, then `findActiveReservations` and `countActiveReservations` with `companyId`, plus `salesRepId = userId` for `SALES`.
  3. Return `{ items, total, page, pageSize, asOf: now }`.
- Order: `expires_at ASC, id ASC`, so the soonest is first and pages stay stable (FR-017). Paging: default 20, max 50 (`paginationFields` from phase 3).
- The list query uses Prisma relation filters (`contract: { is: null }` or `contract: { approvedAt: null }`) and `select`s unit `projectName`/`number`, client `name`, and salesRep `id`/`name`.

**Rationale**: Releasing first keeps the units list and the reservations list consistent at the same moment. It also gives the "next view" correctness from SC-003 to this page.

**Alternatives considered**: computing "active" in JS after loading. Rejected: paging would be wrong.

## R6. Units list shows the reservation's expiry (FR-019a; changes phase 3 code)

**Decision**:
- `units.repository.ts › findUnits` and `findUnit` also select the unit's active reservation's `expiresAt` (Prisma relation `reservations: { where: { expiresAt: { gt: now } }, select: { expiresAt: true }, take: 1 }`).
- `now` is the DB time from the same transaction (R4; the units feature gets its own small `dbNow`, because it cannot import the reservations repository).
- `UnitDto` gains `reservedUntil: string | null`: an ISO string while RESERVED, otherwise `null`. Client and rep are never selected.

**Rationale**:
- A repository may read any table through Prisma. The rule is that the **units feature never imports the reservations feature**, and this keeps that rule.
- The expiry is not secret (clarification Q3), but the client and the rep are.

**Alternatives considered**: a units → reservations import. Rejected: it creates a dependency cycle (AGENTS §2).

## R7. Reserve dialog: composed by the page, opened by the URL

**Decision** (AGENTS §2 as amended on 2026-11-12, commit `e3f19ed`: "`page.tsx` may combine components from several features by passing one into another as a prop (slot)"):
- `src/app/(app)/units/page.tsx` renders `<UnitsPage reserveDialog={<ReserveUnitDialog />} />`.
- `UnitsPage` (units feature) renders the slot once. The "حجز" button on an AVAILABLE row is shown only to `SALES`. It sets `?reserve=<unitId>` in the URL and keeps every other query param.
- `ReserveUnitDialog` (reservations feature) reads `reserve` from the URL with `useSearchParams`. It is open while the param is a UUID. It loads `GET /api/reservations/options?unitId=…` (R8). On close or success it removes `reserve` from the URL with `router.replace` (no new history entry).
- After success it shows a sonner toast and invalidates `reservationKeys.all`. It also invalidates the units list with the key prefix `["units"]`, which is passed to it as a prop from `UnitsPage` (`unitsQueryKey`), so it imports nothing from the units feature.
- On 409 it shows the conflict message at the top of the form and invalidates the units list, so the row's status refreshes (FR-020).

**Rationale**:
- No feature imports another feature's client code.
- The URL holds the dialog state: refresh and the back button behave well.
- The same pattern repeats in phase 5 (contract from a reservation) and phase 6 (payment form).

**Alternatives considered**:
- A separate `/reservations/new` page. It follows the rules, but it changes clarification Q2.
- A dialog inside the units feature. Rejected: it would import the reservations schema and the clients queries.

## R8. Data for the dialog: `GET /api/reservations/options?unitId=…`

**Decision**: `getReserveOptions(user, unitId)`:
1. `SALES` only (403).
2. `withTransaction`: `releaseExpired`, then `getUnit` through `units/server/index.ts` (404 for another company).
3. Load the rep's own clients through `clients/server/index.ts › listClients(user, { page: 1, pageSize: 50 })`.
4. Return `{ unit: { id, projectName, number, status }, clients: [{ id, name }] }`.

The dialog shows the unit, a client `<select>` and the "no clients yet" message with a link to `/clients/new` (FR-019). If `unit.status !== "AVAILABLE"`, it shows the "no longer available" message instead of the form.

**Rationale**:
- One request gives the dialog everything it needs, using server-side imports in the allowed direction (reservations → units, clients).
- The client list is scoped to the rep by the clients service, so the picker can never offer another rep's client. The reserve call still re-checks ownership on its own (R1 step 2).

**Limit**: the picker shows the rep's first 50 clients by name. A search box is listed in the README "Not done" (the seed has 3 per rep).

**Alternatives considered**:
- Two client-side requests using the units and clients query options. Rejected: that is a cross-feature client import.
- Server props from `page.tsx`. Rejected: the client list would be stale after the rep adds a client.

## R9. Status codes and check order

| Case | Code | HTTP |
|---|---|---|
| Body not JSON, `unitId`/`clientId` missing or not a UUID, bad paging | `VALIDATION_ERROR` + `fieldErrors` | 400 |
| `MANAGER` or `ACCOUNTANT` reserves; `ACCOUNTANT` lists; non-`SALES` asks for options | `FORBIDDEN` | 403 |
| Client of another rep, of another company, or missing | `NOT_FOUND` | 404 |
| Unit of another company or missing | `NOT_FOUND` | 404 |
| Unit RESERVED (active) or SOLD, lost the race, or DB guard hit | `UNIT_NOT_AVAILABLE` | 409 |

**Order**: Origin (route wrapper) → session 401 → schema 400 → role 403 → client 404 → unit 404/409.

Ids in the **body** are form fields, so a malformed one is a 400 with a field error (spec FR-009). Phase 3's "malformed path id → 404" rule is for path params only, and this phase has none.

The Arabic message for `UNIT_NOT_AVAILABLE` (in `src/shared/lib/error-messages.ts`): "هذه الوحدة لم تعد متاحة، فقد حُجزت للتو. اختر وحدة أخرى."

## R10. Proving concurrency

**Decision**: three integration tests on real Postgres. Service-level tests are the main proof (as in phase 3); route-level tests cover HTTP status codes.

1. **Parallel reserve, available unit** (the user's "done when", SC-001):
   - `Promise.all` of `reserveUnit(rep1, {unit, client1})` and `reserveUnit(rep2, {unit, client2})` with `allSettled`.
   - Assert exactly 1 fulfilled and 1 rejected with `UNIT_NOT_AVAILABLE`, 1 reservation row for the unit, and the unit `RESERVED`.
   - Repeat 10 times on fresh units.
2. **Parallel reserve, just-expired unit**: the same, but the unit starts RESERVED with an expired reservation. This proves R2 inside the reserve path. Repeat 10 times.
3. **Release vs reserve, deterministic** (proves R2 and fails with phase 3's single statement):
   1. Transaction A runs `releaseExpired` and `reserveUnitIfAvailable`, inserts the reservation, and then waits on a promise before it commits.
   2. Start `listUnits(manager)` (B).
   3. Poll `pg_stat_activity` until B's backend shows `wait_event_type = 'Lock'` (timeout 3 s).
   4. Let A commit, then await B.
   5. Assert the unit is still `RESERVED`, B's result shows it `RESERVED`, and there is exactly 1 active reservation.

**Rationale**: `Promise.all` alone rarely produces the release-vs-reserve interleaving. Holding A open makes the test fail every time with the old code and pass every time with the fix.

The test needs 3 connections (A, B, and the poller). The Prisma pg adapter's pool default (10) is enough. A's interactive-transaction timeout stays at the 5 s default.

## R11. Dates on screen

**Decision**:
- `formatRiyadhDateTime(iso)` in `src/shared/lib/dates.ts` uses `format(new TZDate(iso, "Asia/Riyadh"), "yyyy/MM/dd HH:mm")` (`date-fns` + `@date-fns/tz`, from phase 0).
- `formatTimeLeft(expiresAt, asOf)` gives "X ساعة و Y دقيقة" or "أقل من دقيقة". It is computed from the list's `asOf`, not from the browser clock, so the server render and the client render match (no hydration mismatch).
- The list refetches on window focus (the TanStack default), which refreshes `asOf`.

**Alternatives considered**: `Intl.DateTimeFormat("ar-SA")`. Node's and the browser's ICU data can format it differently, which causes hydration mismatches. A ticking countdown was also considered; it adds client timers for little value.

## R12. Dependencies on phases 2 and 3

This phase does not create any phase 2 or phase 3 module. It needs:

| From | Name (as planned there) | Used for |
|---|---|---|
| Phase 2 | `requireUser()`, `SessionUser { userId, companyId, role, name, companyName }` | pages, services |
| Phase 2 | `handleRoute({ auth: "user", handler })` with the user passed to the handler | API routes |
| Phase 2 | `src/shared/lib/navigation.ts › NAV_ITEMS`, `navItemsFor(role)` | the "الحجوزات" nav item for MANAGER and SALES |
| Phase 2 | `tests/integration/support/http.ts` (`apiRequest`), session fixture | route-level tests |
| Phase 3 | `units/server/index.ts › releaseExpired, getUnit` (+ new `reserveUnitIfAvailable`, `findUnitStatus`) | reserve, options |
| Phase 3 | `clients/server/index.ts › getClient, listClients` | ownership, picker |
| Phase 3 | `paginationFields`, `Page<T>`, `toSkip`, `applyApiError`, `apiFetch`, UI primitives (`table`, `alert`, `skeleton`, `native-select`), shared `empty-state`, `error-state`, `table-skeleton`, `pagination-nav` | list and dialog |
| Phase 3 | `tests/integration/support/session-users.ts › makeSessionUser` | service tests |

The dialog needs a shadcn `dialog` primitive. If phase 2 or 3 did not add one, it comes from the shadcn CLI. That is not a new npm dependency, because `radix-ui` was approved in phase 2.

If phases 2 and 3 land with different names, `/speckit-tasks` adapts the calls. The behaviour does not change.
