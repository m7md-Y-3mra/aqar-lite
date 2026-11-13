---
description: "Task list for phase 4: unit reservations"
---

# Tasks: Unit Reservations

**Input**: Design documents from `specs/005-unit-reservations/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/reservations-api.md](./contracts/reservations-api.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The user's "done when" names three tests:
- two parallel reservations → exactly one succeeds;
- an expired reservation frees the unit;
- a rep cannot reserve for another rep's client.

Constitution I and IV add a cross-company test and the parallel-reservation test. Integration tests use the real test database (never mocks). Test titles below are the `it(...)` names from the plan's proof map.

**Organization**: by user story (spec.md), after a foundational phase that every story needs.

**Commits**: one small Conventional Commit after each task or tightly linked group (AGENTS §9). Before marking a phase done, run `npm run lint && npm run typecheck && npm run test`, plus `npm run test:integration` with `docker compose up -d db`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 from spec.md

## Names used from phases 2 and 3

Check these against the merged code in T001, and update the task text if a name differs:

| Name | From | Where |
|---|---|---|
| `requireUser()`, `SessionUser { userId, companyId, role, name, companyName }` | phase 2 | `src/server/auth/require-user.ts` |
| `handleRoute({ auth: "user", handler })`, `readJson(req)` | phase 0/2 | `src/server/http/route-handler.ts` |
| `NAV_ITEMS`, `navItemsFor(role)` | phase 2 | `src/shared/lib/navigation.ts` |
| `apiRequest`, session-cookie helper | phase 2 | `tests/integration/support/http.ts` |
| `releaseExpired(companyId, tx?)` → count, `findUnit`, `findUnits` | phase 3 | `src/features/units/server/units.repository.ts` |
| `getUnit(user, id)`, `listUnits(user, query)` | phase 3 | `src/features/units/server/units.service.ts` |
| `getClient(user, id)`, `listClients(user, query)` | phase 3 | `src/features/clients/server/clients.service.ts` |
| `paginationFields`, `Page<T>`, `toSkip` | phase 3 | `src/shared/lib/pagination.ts` |
| `toQueryInput` | phase 3 | `src/shared/lib/search-params.ts` |
| `apiFetch`, `applyApiError` | phase 2/3 | `src/shared/lib/api-client.ts`, `src/shared/lib/form-errors.ts` |
| `EmptyState`, `ErrorState`, `TableSkeleton`, `PaginationNav`, UI `table`/`alert`/`skeleton`/`native-select`/`button` | phase 2/3 | `src/shared/components/` |
| `makeTwoCompanies()`, `makeSessionUser(companyId, role)` | phase 3 | `tests/integration/support/session-users.ts` |
| `makeUnit`, `makeClient`, `makeReservation`, `makeContract`, `makeCompany`, `makeUser` | phase 1 | `tests/integration/support/db-fixtures.ts` |

---

## Phase 1: Setup

**Purpose**: get the code from phases 2 and 3, which this phase builds on.

- [x] T001 Rebase `claude/unit-reservations-16e517` onto `main` after phases 2 (`003-auth-app-shell`) and 3 (`004-unit-client-management`) are merged. Run `npm ci`, `npm run db:generate`, `docker compose up -d db`, and then `npm run lint && npm run typecheck && npm run test && npm run test:integration`. All must pass before any change. Then check every name in the table above against the code, and correct this file where one differs.
- [x] T002 [P] If `src/shared/components/ui/dialog.tsx` does not exist, add it with the shadcn CLI (`npx shadcn@latest add dialog`). It is built on `radix-ui` (approved in phase 2), so add no new npm package. Commit `feat: add shadcn dialog primitive`.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: error code, schemas, the fixed release, and the unit-row functions that reserve and every list use.

**⚠️ No user story starts before this phase is done.**

- [x] T003 [P] Add `UNIT_NOT_AVAILABLE: 409` to `ERROR_CODES` in `src/server/http/error-codes.ts`. Add `UNIT_NOT_AVAILABLE: "هذه الوحدة لم تعد متاحة، فقد حُجزت للتو. اختر وحدة أخرى."` to `src/shared/lib/error-messages.ts`. If `tests/unit/shared/lib/error-messages.test.ts` checks that every code has a message, run it.
- [x] T004 [P] Create `src/features/reservations/domain/reservation-window.ts` exporting `RESERVATION_HOURS = 72`. Domain code: no DB or framework imports.
- [x] T005 [P] Create `src/features/reservations/reservations.schemas.ts`. Every rule is defined once, and inputs use `.pick()` only (never `.omit()`):
  - `reservationSchema = z.object({ unitId: z.uuid({ error: "اختر وحدة صحيحة" }), clientId: z.uuid({ error: "اختر عميلاً" }) })`;
  - `reserveInputSchema = reservationSchema.pick({ unitId: true, clientId: true })`;
  - `reservationListQuerySchema = z.object({ ...paginationFields })`;
  - `reserveOptionsQuerySchema = reservationSchema.pick({ unitId: true })`.

  No `companyId`, `salesRepId`, `status` or `expiresAt` in any schema.
- [x] T006 [P] Create `src/features/reservations/reservations.types.ts`:
  - `ReserveInput`, `ReservationListQuery` (`z.infer`);
  - `ReservationDto = { id; expiresAt: string; unit: { id; projectName; number }; client: { id; name }; salesRep: { id; name } }`;
  - `ReservationPage = Page<ReservationDto> & { asOf: string }`;
  - `ReserveOptionsDto = { unit: { id; projectName; number; status }; clients: { id; name }[] }`.

  Create `src/features/reservations/reservations.keys.ts`: `reservationKeys.all = ["reservations"]`, `list(query)`, `options(unitId)`.
- [x] T007 [P] Write `tests/unit/features/reservations/reservations.schemas.test.ts`:
  - "rejects missing / non-UUID unitId and clientId" (both `fieldErrors` keys present);
  - "strips expiresAt, salesRepId, companyId, status";
  - "pageSize 51 → error";
  - "defaults 1 / 20";
  - "options query rejects a non-UUID unitId".

  Commit T004–T007 as `feat: add reservation schemas, types and keys`.
- [x] T008 Fix `releaseExpired(companyId, tx?)` in `src/features/units/server/units.repository.ts` (research R2). Keep the signature and the returned count.
  - Body: `const run = (db: Tx) => …`; with `tx`, call `run(tx)`; without it, call `withTransaction(run)`.
  - Inside `run`:
    1. `const rows = await db.$queryRaw<{ id: string }[]>` with `SELECT u.id FROM units u WHERE u.company_id = ${companyId}::uuid AND u.status = 'RESERVED' AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now()) ORDER BY u.id FOR UPDATE`;
    2. if `rows.length === 0` return 0;
    3. `return db.$executeRaw` with `UPDATE units u SET status = 'AVAILABLE' WHERE u.id = ANY(${ids}::uuid[]) AND u.company_id = ${companyId}::uuid AND u.status = 'RESERVED' AND NOT EXISTS (…same…)`.
  - Use `::uuid` only where the existing phase 3 statement needed it. Phase 3's `units.repository.test.ts` must pass **unchanged**.
  - Add a comment over the function explaining why there are two statements: the snapshot of the `NOT EXISTS` (R2). Also state the rule: call it before locking any unit row, never inside another service's transaction.
- [x] T009 Add to `src/features/units/server/units.repository.ts` (all take `companyId` first, with `tx`):
  - `reserveUnitIfAvailable(companyId, unitId, tx)`: `updateMany({ where: { id: unitId, companyId, status: "AVAILABLE" }, data: { status: "RESERVED" } })` → count;
  - `findUnitStatus(companyId, unitId, tx)`: `findFirst({ where: { id: unitId, companyId }, select: { status: true } })`;
  - `dbNow(tx?)`: `SELECT now() AS now` → `Date`.

  Export `releaseExpired`, `reserveUnitIfAvailable` and `findUnitStatus` from `src/features/units/server/index.ts`, next to phase 3's exports (`getUnit`, `listUnits` and the route handlers).
- [x] T010 [P] Create `tests/integration/support/pg-locks.ts`: `waitForLockWait(queryLike: string, timeoutMs = 3000)`.
  - It polls `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE ${queryLike}` every 25 ms through `getDb()`.
  - It resolves on the first count above 0, and rejects with a clear message on timeout.
- [x] T011 Write `tests/integration/features/units/server/release-expired.test.ts`, a new file (phase 3's test file stays unchanged):
  - **"release during an open reserve never frees the unit"** (research R10.3):
    1. Create a unit with `status: "RESERVED"` and an expired reservation.
    2. Start transaction A with `withTransaction`: `releaseExpired(companyId, tx)`, then `reserveUnitIfAvailable`, then insert a reservation with `expiresAt` 72 h ahead via `tx.reservation.create`. Then await a deferred promise.
    3. Start `releaseExpired(companyId)` (B) without awaiting it.
    4. `await waitForLockWait("%FOR UPDATE%")`.
    5. Resolve the deferred so A commits, then await B.
    6. Assert the unit is `RESERVED`, B returned 0, and exactly 1 reservation of the unit has `expiresAt > now`.

    Revert T008 locally once and confirm this test fails. Restore T008 before committing.
  - **"releaseExpired frees a unit whose expiresAt equals the transaction now"**: in one `withTransaction`, read `dbNow(tx)`, set the fixture reservation's `expiresAt` to it, call `releaseExpired(companyId, tx)`, and expect 1 and `AVAILABLE`.

  Commit T008–T011 as `fix: lock expired units before release to survive concurrent reserves`.
- [x] T012 [P] Create `src/shared/lib/dates.ts` (`date-fns` + `@date-fns/tz`, no new package):
  - `formatRiyadhDateTime(iso)` = `format(new TZDate(iso, "Asia/Riyadh"), "yyyy/MM/dd HH:mm")`;
  - `formatTimeLeft(expiresAt, asOf)` → "X ساعة و Y دقيقة", "Y دقيقة", or "أقل من دقيقة", computed with `differenceInMinutes`. Never use `Date.now()`.

  Write `tests/unit/shared/lib/dates.test.ts`: "formats 2026-11-12T21:30Z as 2026/11/13 00:30 (Riyadh)", "time left 71 h 59 m", "less than a minute", "never negative". Commit `feat: add Riyadh date helpers`.

**Checkpoint**: the release is safe under concurrency, unit-row functions exist, and the schemas are tested.

---

## Phase 3: User Story 1 - Sales rep reserves an available unit for their own client (Priority: P1) 🎯 MVP

**Goal**: a SALES user reserves from the units list. Exactly one of two parallel requests wins. Refusals change nothing.

**Independent Test**: quickstart §2–§3; `reservations.service.test.ts` › "reserve", "conflict", "concurrency", "ownership", "tenant isolation", "role checks", "options".

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [x] T013 [US1] Write `tests/integration/features/reservations/server/reservations.service.test.ts` (later stories add more blocks to it), using `makeTwoCompanies`, `makeUnit`, `makeClient` and `makeReservation`. Every refusal test asserts that the unit's status and the unit's reservation count are unchanged (FR-008).
  - **"reserve"**:
    - "rep reserves an available unit for own client" (DTO shape; unit `RESERVED`; row `salesRepId` = rep);
    - "expiresAt − 72 h lies between the DB times read just before and just after the call" (`dbNow()` before and after);
    - "ignores hand-sent expiresAt, salesRepId, companyId, status" (input = `reserveInputSchema.parse({...valid, expiresAt: "2030-01-01", salesRepId: otherRep, companyId: B, status: "SOLD"})`).
  - **"conflict"**:
    - "reserved unit → UNIT_NOT_AVAILABLE, nothing changes";
    - "sold unit → UNIT_NOT_AVAILABLE".
  - **"concurrency"**:
    - "two reps, one available unit: exactly one wins": a loop of 10, each on a fresh unit. `Promise.allSettled([reserveUnit(rep1, {unit, client1}), reserveUnit(rep2, {unit, client2})])` gives exactly 1 fulfilled, 1 rejected with `AppError` code `UNIT_NOT_AVAILABLE`, 1 reservation row, and the unit `RESERVED` with `clientId` = the winner's.
    - "two reps, one just-expired unit: exactly one wins": the same, with the unit starting `RESERVED` with an expired reservation (×10).
  - **"ownership"**: "rep cannot reserve for another rep's client" (`NOT_FOUND`, 0 new reservations, unit `AVAILABLE`).
  - **"tenant isolation"**:
    - "unit of company B → NOT_FOUND, B's unit unchanged";
    - "client of company B → NOT_FOUND".
  - **"role checks"**: "MANAGER cannot reserve", "ACCOUNTANT cannot reserve" (`FORBIDDEN`).
  - **"options"**:
    - "returns the unit and only the rep's own clients, by name";
    - "MANAGER and ACCOUNTANT → FORBIDDEN";
    - "unit of company B → NOT_FOUND";
    - "answers within 2 s while another unit of the company has an expired reservation" (guards against nested transactions, R2).
- [x] T014 [P] [US1] Write `tests/integration/features/reservations/server/reservations.routes.test.ts` with phase 2's `apiRequest` and a logged-in session:
  - "POST as accountant → 403";
  - "POST with another rep's client → 404";
  - "409 body has code UNIT_NOT_AVAILABLE and the Arabic message";
  - "400 with fieldErrors.unitId and fieldErrors.clientId";
  - "POST with a foreign Origin → 403 INVALID_ORIGIN";
  - "two parallel POSTs from two rep sessions: one 201, one 409": `Promise.allSettled` of two `reserveHandler(apiRequest("/api/reservations", { method: "POST", body, cookie }))` calls, with sales1 and sales2 cookies and each rep's own client. Exactly one is 201 and one is 409 `UNIT_NOT_AVAILABLE`, and there is 1 reservation row (constitution IV);
  - "route modules export no DELETE, PATCH or PUT" (FR-014): `Object.keys(await import("@/app/api/reservations/route"))` sorted equals `["GET", "POST"]`, and the options route equals `["GET"]`. Handlers are called directly, so Next's 405 cannot be observed here;
  - "GET /api/reservations/options as manager → 403".

### Implementation for User Story 1

- [x] T015 [US1] Create `src/features/reservations/server/reservations.repository.ts` (`import "server-only"`; every function takes `companyId` first):
  - `insertReservation(companyId, { unitId, clientId, salesRepId }, tx)` with `tx.$queryRaw<…>`: `INSERT INTO reservations (company_id, unit_id, client_id, sales_rep_id, expires_at) VALUES (${companyId}::uuid, ${unitId}::uuid, ${clientId}::uuid, ${salesRepId}::uuid, now() + make_interval(hours => ${RESERVATION_HOURS})) RETURNING id`;
  - `findReservationById(companyId, id, tx)` selecting `id, expiresAt, unit { id, projectName, number }, client { id, name }, salesRep { id, name }` (shared `reservationSelect`).
- [x] T016 [US1] Create `src/features/reservations/server/reservations.service.ts` (`import "server-only"`, no Request/Response) with a `toReservationDto(row)` mapper (ISO strings) and:
  - `reserveUnit(user: SessionUser, input: ReserveInput)`:
    1. `user.role !== "SALES"` → `throw new AppError("FORBIDDEN")`;
    2. `await getClient(user, input.clientId)` (throws `NOT_FOUND`);
    3. `withTransaction(async (tx) => …)`: `releaseExpired(user.companyId, tx)` → `reserveUnitIfAvailable(user.companyId, input.unitId, tx)`. On 0 rows, `findUnitStatus(...)`: `null` → `NOT_FOUND`, else `UNIT_NOT_AVAILABLE`. Then `insertReservation(user.companyId, { …input, salesRepId: user.userId }, tx)` → `findReservationById` → DTO.

    No other service is called inside the transaction (R2).
  - `getReserveOptions(user, unitId)`: role ≠ SALES → `FORBIDDEN`; `const unit = await getUnit(user, unitId)`; `const clients = await listClients(user, { page: 1, pageSize: 50 })`; return `{ unit: { id, projectName, number, status }, clients: clients.items.map(({ id, name }) => ({ id, name })) }`. No outer transaction.
- [x] T017 [US1] Create `src/features/reservations/server/reservations.routes.ts`:
  - `reserveHandler = handleRoute({ auth: "user", handler })`: `reserveInputSchema.parse(await readJson(req))`, then `reserveUnit(user, input)`, then `{ data, status: 201 }`.
  - `reserveOptionsHandler`: `reserveOptionsQuerySchema.parse(toQueryInput(new URL(req.url).searchParams))`, then `getReserveOptions`.

  Create `src/features/reservations/server/index.ts` exporting the handlers. Create `src/app/api/reservations/route.ts` (`export { reserveHandler as POST }`) and `src/app/api/reservations/options/route.ts` (`export { reserveOptionsHandler as GET }`). Run T013 and T014 until green, then commit `feat: reserve a unit in one conditional transaction`.
- [x] T018 [US1] Show the reservation's expiry on the units list (FR-019a, research R6):
  - `src/features/units/server/units.repository.ts › findUnits` and `findUnit` take a `now: Date` and add `reservations: { where: { expiresAt: { gt: now } }, select: { expiresAt: true }, take: 1 }`. Never select client or rep.
  - `src/features/units/server/units.service.ts`: `listUnits` and `getUnit` call `releaseExpired(companyId)` first, then `const now = await dbNow()`, then pass `now`. The mapper sets `reservedUntil = row.status === "RESERVED" ? row.reservations[0]?.expiresAt.toISOString() ?? null : null`.
  - `src/features/units/units.types.ts`: `UnitDto` gets `reservedUntil: string | null`.
  - Add to `tests/integration/features/units/server/units.service.test.ts`: "list › reserved unit has reservedUntil = active expiry", "list › available unit has reservedUntil null", "list › DTO has no client or salesRep key".

  Commit `feat: show reserved-until on units`.
- [x] T019 [P] [US1] Create `src/features/reservations/client/reservations.queries.ts`:
  - `reserveOptionsOptions(unitId)` = `queryOptions({ queryKey: reservationKeys.options(unitId), queryFn: () => apiFetch<ReserveOptionsDto>(…), staleTime: 0 })`;
  - `reserveUnit(input)` = `apiFetch<ReservationDto>("/api/reservations", { method: "POST", body })`.
- [x] T020 [US1] Create the `src/features/reservations/client/reserve-unit-dialog/` folder:
  - `types.ts`: `ReserveUnitDialogProps { unitsQueryKey: readonly unknown[] }`.
  - `use-reserve-unit-dialog.ts`:
    - read `reserve` with `useSearchParams`; `open = z.uuid().safeParse(value).success`. An invalid value is removed with `router.replace`.
    - `close()` = `router.replace` with the current path and params minus `reserve`, `{ scroll: false }`.
    - `useQuery({ ...reserveOptionsOptions(unitId), enabled: open })`.
    - RHF `useForm({ resolver: zodResolver(reserveInputSchema), values: { unitId, clientId: "" } })`.
    - `useMutation(reserveUnit)`:
      - success → `toast.success("تم حجز الوحدة حتى " + formatRiyadhDateTime(data.expiresAt))`, invalidate `reservationKeys.all` and `unitsQueryKey`, then `close()`;
      - error → `applyApiError(err, form.setError)`. On 409 also invalidate `unitsQueryKey`.
  - `reserve-unit-dialog.tsx`: the states from `contracts/reservations-api.md › UI contract`:
    - skeleton; error + retry;
    - "not AVAILABLE" message;
    - no clients → "أضف عميلاً أولاً" with a `Link` to `/clients/new`;
    - form with a `NativeSelect` of clients, its error under it, a root error as an `Alert` at the top, and "تأكيد الحجز" disabled while pending.

    Arabic text only; logical classes only (`ms-`/`me-`/`ps-`/`pe-`).
  - `index.ts`: export the component and its types.
- [x] T021 [US1] Change the units page to host the slot (AGENTS §2 as amended in `e3f19ed`):
  - `src/features/units/client/units-page/units-page.tsx` takes `reserveDialog?: ReactNode` (props type in the folder's `types.ts`) and renders it once.
  - `use-units-page.ts` gains `openReserve(unitId)`: `router.replace` with the current params plus `reserve=<id>`, `{ scroll: false }`.
  - `components/units-table/units-table.tsx`:
    - a "حجز" `Button` only when `user.role === "SALES" && unit.status === "AVAILABLE"` (role from phase 2's `useCurrentUser`, for display only);
    - a RESERVED row shows "حتى " + `formatRiyadhDateTime(unit.reservedUntil)` under the status badge.
  - `src/app/(app)/units/page.tsx` renders `<UnitsPage reserveDialog={user.role === "SALES" ? <ReserveUnitDialog unitsQueryKey={unitKeys.all} /> : null} />`.

  No units file imports from `src/features/reservations`. Check with `npm run lint` (import rules) and a grep. Commit `feat: reserve dialog opened from the units list`.

**Checkpoint**: US1 works end to end (quickstart §2, §3, §6). This is the MVP.

---

## Phase 4: User Story 2 - An expired reservation makes the unit available again (Priority: P1)

**Goal**: prove expiry with no manual action and no job. The code exists from T008 and T016; this story adds the user's "done when" proof and history.

**Independent Test**: `reservations.service.test.ts` › "expiry"; quickstart §4.

- [x] T022 [US2] Add an **"expiry"** block to `tests/integration/features/reservations/server/reservations.service.test.ts`:
  - "expired reservation frees the unit and another rep can reserve it":
    1. rep1 reserves;
    2. set that reservation's `expiresAt` to 1 minute ago with `getDb().reservation.update`;
    3. `listUnits(manager)` shows the unit `AVAILABLE` and `reservedUntil` `null`;
    4. `reserveUnit(rep2, { unit, client2 })` succeeds with a new expiry.
  - "the expired reservation row still exists after the unit is re-reserved" (FR-013);
  - "a SOLD unit with an expired reservation stays SOLD and cannot be reserved" (`UNIT_NOT_AVAILABLE`; FR-012).

  Commit `test: prove reservation expiry frees the unit`.

**Checkpoint**: all three "done when" tests pass: T013 concurrency, T013 ownership, T022 expiry.

---

## Phase 5: User Story 3 - Sales rep sees their own active reservations (Priority: P2)

**Goal**: a `/reservations` page listing the rep's active reservations, soonest first, with Riyadh expiry and time left.

**Independent Test**: quickstart §5 (sales1 rows); `reservations.service.test.ts` › "list".

- [ ] T023 [US3] Add a **"list"** block to `tests/integration/features/reservations/server/reservations.service.test.ts`:
  - "rep sees only own";
  - "DTO has unit, client, salesRep, expiresAt";
  - "excludes expired";
  - "excludes a reservation whose contract is approved" (`makeContract` with `approvedAt` set);
  - "includes one with a draft contract";
  - "soonest expiry first, id breaks ties, pages never repeat or skip" (page 1 ∪ page 2 = all, disjoint, `pageSize` 2);
  - "asOf is the DB time".

  Create `tests/integration/features/reservations/server/reservations.repository.test.ts`: "findActiveReservations excludes a row whose expiresAt equals now" (pass `now` = the fixture's `expiresAt`).
- [ ] T024 [US3] Add to `src/features/reservations/server/reservations.repository.ts`:
  - `activeWhere(companyId, { salesRepId?, now })` = `{ companyId, salesRepId, expiresAt: { gt: now }, OR: [{ contract: { is: null } }, { contract: { is: { approvedAt: null } } }] }`;
  - `findActiveReservations(companyId, filter, { skip, take }, tx)` with `orderBy [{ expiresAt: "asc" }, { id: "asc" }]` and `reservationSelect`;
  - `countActiveReservations(companyId, filter, tx)`;
  - `dbNow(tx)`.
- [ ] T025 [US3] Add `listActiveReservations(user, query)` to `src/features/reservations/server/reservations.service.ts`:
  1. `ACCOUNTANT` → `FORBIDDEN`;
  2. `withTransaction`: `releaseExpired(companyId, tx)` → `now = dbNow(tx)` → `salesRepId = user.role === "SALES" ? user.userId : undefined` → find + count;
  3. return `{ items, total, page, pageSize, asOf: now.toISOString() }`.

  Add `listReservationsHandler` (query via `toQueryInput` + `reservationListQuerySchema`) to `reservations.routes.ts`. Export it, and `listActiveReservations`, from `server/index.ts`. Add `export { listReservationsHandler as GET }` to `src/app/api/reservations/route.ts`. Commit `feat: list active reservations`.
- [ ] T026 [P] [US3] Add `reservationListOptions(query)` to `src/features/reservations/client/reservations.queries.ts`, with `placeholderData: keepPreviousData`.
- [ ] T027 [US3] Create `src/features/reservations/client/reservations-page/`:
  - `reservations-page.tsx`: states:
    - `isPending` → `TableSkeleton`;
    - dimmed while `isFetching && isPlaceholderData`;
    - empty → `EmptyState` "لا توجد حجوزات نشطة" with a link to `/units`;
    - `isError` → `ErrorState` with retry;
    - `PaginationNav`.
  - `use-reservations-page.ts`: URL ⇄ page.
  - `index.ts`.
  - `components/reservations-table/reservations-table.tsx` (+ `index.ts`), a shadcn `Table` with columns:
    - unit (`projectName` – `number`);
    - client;
    - rep (only when `user.role === "MANAGER"`);
    - "ينتهي في" = `formatRiyadhDateTime(expiresAt)`;
    - "المتبقي" = `formatTimeLeft(expiresAt, asOf)`.

    User text is rendered as text. The table scrolls inside its own container on small screens.
- [ ] T028 [US3] Create `src/app/(app)/reservations/page.tsx`:
  1. `const user = await requireUser()`; `user.role === "ACCOUNTANT"` → `redirect("/")`;
  2. `reservationListQuerySchema.safeParse(toQueryInput(await searchParams))`;
  3. `prefetchQuery({ queryKey: reservationKeys.list(query), queryFn: () => listActiveReservations(user, query) })`;
  4. `<HydrationBoundary state={dehydrate(queryClient)}><ReservationsPage /></HydrationBoundary>`.
- [x] T029 [P] [US3] Add `{ href: "/reservations", label: "الحجوزات", roles: ["MANAGER", "SALES"] }` to `NAV_ITEMS` in `src/shared/lib/navigation.ts`. Add "reservations item for MANAGER and SALES, not ACCOUNTANT" to `tests/unit/shared/lib/navigation.test.ts`. Commit T026–T029 as `feat: reservations page for reps`.

**Checkpoint**: a rep sees their own active reservations with the expiry and the time left.

---

## Phase 6: User Story 4 - Manager sees all active reservations in the company (Priority: P2)

**Goal**: the same page for the manager, with every rep's rows and a rep column. The accountant is refused.

**Independent Test**: quickstart §5 (manager and accountant rows); `reservations.service.test.ts` › "list" (manager) and "tenant isolation".

- [ ] T030 [US4] Add to `tests/integration/features/reservations/server/reservations.service.test.ts`:
  - "list › manager sees all reps of the company";
  - "role checks › ACCOUNTANT cannot list";
  - "tenant isolation › manager of A never sees B's reservations";
  - "tenant isolation › rep of A never sees B's reservations".

  Add to `reservations.routes.test.ts`: "GET as accountant → 403", "GET /api/reservations?companyId=<B> as manager of A returns only A's rows".
- [ ] T031 [US4] Confirm `reservations-table.tsx` shows the rep column only for MANAGER, and that the rep column and the service filter both pass T030. Commit `test: manager and accountant access to reservations`.

**Checkpoint**: all four stories work on their own.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T032 [P] Update `README.md`:
  - **Assumptions**: from spec.md › Assumptions and Clarifications — no reservation limit (and the hoarding risk); reserve only from the units list; the accountant has no reservations view; "active" = strictly future expiry and no approved contract; the DB clock; 404 vs 409.
  - **Technical decisions**: R1 (conditional update; 0 rows → re-read → 404/409), R2 (two-statement release; READ COMMITTED; lock order; no nested transactions), R4 (one DB clock), R7 (page-level slot composition, URL-driven dialog).
  - **Not done**: manual cancel; per-rep or per-client cap; client search in the picker (first 50 by name); an exclusion constraint as a second DB guard against overlapping reservations (`btree_gist`, `reserved_at` + `expires_at` range per unit; research R3).
  - **Security**: R2 under "duplicated money operations / double reservation".
- [ ] T033 Run quickstart §2–§7 by hand at 375 px and 1280 px, as sales1, sales2, manager and accountant. Fix what fails.
- [ ] T034 Run `npm run lint && npm run typecheck && npm run test` and `npm run test:integration`. Run the concurrency block 3 times in a row (`npx vitest run --config vitest.integration.config.ts -t concurrency`) to show it is stable. Then run `/security-review` and fix every open issue.
- [ ] T035 Check that `CLAUDE.md` is still only `@AGENTS.md` (no technologies block), and that no file in `src/features/units` or `src/features/clients` imports from `src/features/reservations`. Commit `docs: phase 4 README notes`.

---

## Dependencies & Execution Order

- **Setup (T001–T002)**: waits for phases 2 and 3 to be merged.
- **Foundational (T003–T012)**: after Setup. T008 → T011, and T009 → T011. T005 → T007.
- **US1 (T013–T021)**: after Foundational. Tests T013/T014 first, then T015 → T016 → T017; T018 after T009; T019 → T020 → T021.
- **US2 (T022)**: after US1 (uses `reserveUnit`).
- **US3 (T023–T029)**: after Foundational. Its backend (T023–T025) does not need US1's UI. Its UI needs T019's file to exist (T026 adds to it).
- **US4 (T030–T031)**: after US3 (same service and page).
- **Polish (T032–T035)**: after all stories.

## Parallel Opportunities

- Foundational: T003, T004, T005, T006, T010 and T012 touch different files and can run together. Then run T007 (after T005), and T008 → T009 → T011 in order.
- US1: T014 alongside T013. T019 alongside T015–T017.
- US3: T026 and T029 alongside T024–T025.
- US3's backend (T023–T025) can start while US1's UI (T019–T021) is in progress.

Example (Foundational):

```text
T003 error code + message      T004 reservation-window.ts
T005 schemas                   T006 types + keys
T010 pg-locks.ts               T012 dates.ts + test
```

## Implementation Strategy

1. **MVP = Setup + Foundational + US1 + US2**. This proves all three "done when" tests and the release-race fix. Stop and validate with quickstart §2–§4.
2. Add US3 (rep list), then US4 (manager view and access tests).
3. Polish: README, the manual pass, the full test run, `/security-review`.
4. If time runs out after the MVP: the list page (US3/US4) is the part to cut. Write it in README "Not done" (constitution VIII rule: finish the smallest version that passes its tests).
