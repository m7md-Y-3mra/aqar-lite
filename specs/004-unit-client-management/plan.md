# Implementation Plan: Units and Clients

**Branch**: `claude/unit-client-management-5ac1e8` (spec folder `004-unit-client-management`) | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-unit-client-management/spec.md`

> **Blocked on phase 2.** Phase 1 (schema and seed) is merged and this branch is rebased on it. Phase 2 (authentication and app shell) is not specified yet. Implementation starts only after phase 2 is merged (constitution › Development Workflow). What this phase needs from phase 2 is listed in [research.md R11](./research.md#r11-dependency-on-phase-2-authentication).

## Summary

Add the `units` and `clients` features.

**Units**
- Any staff user lists the units of their company, with server-side status and price-range filters, sorting by price or area, and offset pages.
- A manager adds and edits units.
- A price change succeeds only while the unit is available. It runs as one conditional update plus a `PRICE_CHANGED` audit row in the same transaction.
- Expired reservations are released lazily, by one SQL `UPDATE` before every unit read or edit.

**Clients**
- A sales rep adds and edits only their own clients.
- Managers and accountants read all clients of their company.

**Access rules**
- A record of another company, or another rep's client for a sales rep, is 404.
- A role that is not allowed is 403, checked after the record lookup.

The main proofs are service-level integration tests on real Postgres.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Node 22 LTS

**Primary Dependencies**: Next.js 16 (App Router, Route Handlers), React 19, TanStack Query 5, Zod 4, React Hook Form 7 + `@hookform/resolvers`, Prisma 7 + `@prisma/adapter-pg`, Tailwind 4, sonner, shadcn/`radix-ui` (added and approved in phase 2). **No new dependency in this phase** (research R7).

**Storage**: PostgreSQL. Phase 1 tables `units`, `clients`, `reservations` (read only), `audit_logs` (insert only). One new migration with check constraints only (R9).

**Testing**: Vitest. Unit tests in `tests/unit` (no DB). Integration tests in `tests/integration` on the real `aqar_test` database, rebuilt every run.

**Target Platform**: Linux container (`docker compose up`), modern mobile and desktop browsers

**Project Type**: Web application (one Next.js project, feature folders)

**Performance Goals**: A list page answers in well under 1 s with the seed data (≈ 10–20 units per company). The spec's success criteria are about task time (SC-006/007), not throughput.

**Constraints**:
- Every query filtered by the session `companyId`.
- Money in integer halalas.
- Page size max 50.
- No new packages.
- No Server Actions.
- Arabic RTL with logical CSS classes only.

**Scale/Scope**:
- 2 features, 7 pages, 4 API route files (8 handlers).
- 1 migration.
- About 10 test files.

## Constitution Check

*Gate before research: PASS. Re-checked after design (below): PASS.*

| # | Principle | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| I | Tenant Isolation | PASS | `companyId` (and `userId`) come only from `SessionUser`. Every repository function takes `companyId` first and puts it in every `WHERE`. Another company → 404 (R3). Proven by `units.service.test.ts` and `clients.service.test.ts` › "tenant isolation". |
| II | Server-Side Authorization | PASS | The role and ownership check is in each service function (R3). Pages for manager-only or rep-only screens also check the role on the server. Input schemas use `.pick()` with no `status`, `companyId` or `salesRepId`. Proven by "role checks" and "ignores hand-sent fields". |
| III | Financial Accuracy | PASS | Price is `bigint` in halalas in the DB and an integer in DTOs, query and body. Conversion happens only in `src/shared/lib/money.ts` (R5). No float math. |
| IV | Atomic and Concurrency-Safe | PASS | The price edit and the audit row are in one `withTransaction`. The conditional update re-checks status and price (R1). Status changes only through `releaseExpired` (RESERVED → AVAILABLE). Users cannot write status. |
| V | Database-Enforced Integrity | PASS | Existing price/area/rooms/trim checks and the unique `(company, project, number)` index are reused. The new migration adds client name/phone checks and a unit price cap (R9). Audit rows are append-only (phase 1 triggers). |
| VI | Layered Architecture | PASS | Flow: `route.ts` → `<f>.routes.ts` → `<f>.service.ts` → `<f>.repository.ts`. Only repositories and `src/server/db.ts` touch Prisma (enforced by lint). `units` and `clients` do not import each other. Strict TS, no `any`. |
| VII | Security by Default | PASS | Zod on every body, query and path id. Raw SQL only as a tagged template (bound parameters). Notes are rendered as text, and `dangerouslySetInnerHTML` is banned by a test (R10). Errors are generic Arabic messages. `PRICE_CHANGED` is audited. |
| VIII | Scope Discipline | PASS | No delete, no client search, no unit detail page beyond the edit form, no new dependency of this phase (`radix-ui` comes from phase 2, approved there). Assumptions go to the README. |

## Departures from the agreed plan notes

1. **Schema change**: one new migration with `clients_name_check`, `clients_phone_check` and `units_price_max_check` (R9).
   - **Why**: constitution V. Phase 1 has the same trim checks on unit text but none on clients, and no upper bound on price. The cap (10^11 halalas) keeps `Number(price)` exact.
   - It adds no column and no table.
2. **Role check order**: the record lookup (404) runs before the role check (403) for reads and edits of one record (R3).
   - **Why**: the spec matrix and FR-022 require 404 for another company's record for every role. A role-first check would answer 403.
   - The plan notes do not fix an order, so this is a clarification, not a change.
3. **Unchanged-price edits** do not use the `WHERE status = 'AVAILABLE'` condition (R1).
   - **Why**: FR-011 says an edit that keeps the price is never refused because of the status.
   - Price changes still use the agreed condition, plus `price = oldPrice`.

4. **A second price conflict code, `UNIT_CHANGED` (409)**: returned when the unit is still available but another manager changed its price first, so the conditional update matched 0 rows (R1).
   - **Why**: `UNIT_PRICE_LOCKED` would be the wrong message in that case. The spec's Edge Cases ("Two managers change one price at once") now describe this behaviour.
   - Proven by "price lock › two concurrent price edits never share an oldPrice".

No other departures. Every agreed decision is kept as written.

## Project Structure

### Documentation (this feature)

```text
specs/004-unit-client-management/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R12 decisions
├── data-model.md         # fields, rules, transitions, DTOs, query params
├── quickstart.md         # how to validate
├── contracts/
│   ├── units-api.md
│   └── clients-api.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not created here)
```

### Source Code: every file created or changed

Legend: **new**, **change**. **P2?** = expected from phase 2; create it here only if phase 2 did not.

Two names are left open on purpose and are filled in by `/speckit-tasks` after phase 2 lands:
- `<timestamp>`: set by `prisma migrate dev --create-only`.
- `<phase 2 nav component>`: phase 2 names that file.

```text
# Database
prisma/migrations/<timestamp>_units_clients_checks/migration.sql   new   clients name/phone trim + not-empty checks; units price <= 10^11 (R9)

# Server infrastructure (src/server)
src/server/db.ts                          change  + isUniqueViolation(err, constraint) (R6)
src/server/http/error-codes.ts            change  + UNIT_PRICE_LOCKED: 409, UNIT_CHANGED: 409

# Shared (src/shared)
src/shared/lib/error-messages.ts          change  + Arabic text for the 2 new codes
src/shared/lib/money.ts                   new     parseRiyals(text) → halalas | null; formatRiyals(halalas) (R5)
src/shared/lib/search-params.ts           new     toQueryInput(URLSearchParams | record): "" → undefined, repeated → string[] (R4)
src/shared/lib/pagination.ts              new     paginationFields (page, pageSize zod), Page<T>, toSkip(page, pageSize)
src/shared/lib/api-client.ts              P2?     apiFetch<T>(url, init): unwraps { data } / throws ApiError { status, code, message, fieldErrors }
src/shared/lib/form-errors.ts             new     applyApiError(err, setError): 400 fieldErrors → setError(field); 409/other → setError("root")
src/shared/components/ui/button.tsx       P2      from phase 2 (shadcn); reused (R7)
src/shared/components/ui/input.tsx        P2      from phase 2 (shadcn); reused
src/shared/components/ui/label.tsx        P2      from phase 2 (shadcn); reused
src/shared/components/ui/textarea.tsx     new     shadcn CLI (R7)
src/shared/components/ui/native-select.tsx new    shadcn CLI; native <select>
src/shared/components/ui/table.tsx        new     shadcn CLI; plain Table
src/shared/components/ui/badge.tsx        new     shadcn CLI
src/shared/components/ui/skeleton.tsx     new     shadcn CLI
src/shared/components/ui/alert.tsx        new     shadcn CLI
src/shared/components/money-input/money-input.tsx   new   riyal text in local state, halalas into the form (R5)
src/shared/components/money-input/index.ts          new
src/shared/components/pagination-nav/pagination-nav.tsx  new   previous/next + "page X of Y"; builds hrefs from the current query
src/shared/components/pagination-nav/index.ts           new
src/shared/components/empty-state/empty-state.tsx   new
src/shared/components/empty-state/index.ts          new
src/shared/components/error-state/error-state.tsx   new   message + retry button or reset link
src/shared/components/error-state/index.ts          new
src/shared/components/table-skeleton/table-skeleton.tsx  new
src/shared/components/table-skeleton/index.ts           new

# Units feature
src/features/units/units.schemas.ts       new  unitSchema (field rules once), unitInputSchema (.pick), unitListQuerySchema, unitIdSchema, UNIT_NUMBER_TAKEN message
src/features/units/units.types.ts         new  UnitDto, UnitInput, UnitListQuery (z.infer), UnitPage
src/features/units/units.keys.ts          new  unitKeys.all / list(query) / detail(id)
src/features/units/server/units.repository.ts  new  releaseExpired, findUnits, countUnits, findUnit, insertUnit, updateUnitDetails, updateUnitPriceIfAvailable (all take companyId; optional tx)
src/features/units/server/units.service.ts     new  listUnits, getUnit, createUnit, updateUnit (SessionUser first arg; DTO mapper)
src/features/units/server/units.routes.ts      new  listUnitsHandler, createUnitHandler, getUnitHandler, updateUnitHandler
src/features/units/server/index.ts            new  public API: listUnits, getUnit, releaseExpired (phase 4), route handlers
src/features/units/client/units.queries.ts     new  unitListOptions(query), unitDetailOptions(id) via queryOptions(); createUnit/updateUnit fetchers
src/features/units/client/unit-labels.ts       new  Arabic labels for UnitType and UnitStatus
src/features/units/client/units-page/units-page.tsx      new  parses URL, useQuery(placeholderData: keepPreviousData), loading/empty/error, manager-only "إضافة وحدة"
src/features/units/client/units-page/use-units-page.ts   new  URL ⇄ query, setFilters (resets page), setPage
src/features/units/client/units-page/index.ts            new
src/features/units/client/units-page/components/units-filters/units-filters.tsx  new  status select, min/max price (MoneyInput), sort + order
src/features/units/client/units-page/components/units-filters/index.ts           new
src/features/units/client/units-page/components/units-table/units-table.tsx      new  shadcn Table; edit link for managers only
src/features/units/client/units-page/components/units-table/index.ts             new
src/features/units/client/units-page/components/unit-status-badge/unit-status-badge.tsx  new
src/features/units/client/units-page/components/unit-status-badge/index.ts               new
src/features/units/client/unit-form/unit-form.tsx        new  create + edit; price field read-only with a hint when the status is not AVAILABLE
src/features/units/client/unit-form/use-unit-form.ts     new  RHF + zodResolver(unitInputSchema), useMutation, invalidate unitKeys.all, applyApiError, toast
src/features/units/client/unit-form/index.ts             new

# Clients feature
src/features/clients/clients.schemas.ts   new  clientSchema, clientInputSchema (.pick), clientListQuerySchema, clientIdSchema
src/features/clients/clients.types.ts     new  ClientDto, ClientInput, ClientListQuery, ClientPage
src/features/clients/clients.keys.ts      new  clientKeys.all / list(query) / detail(id)
src/features/clients/server/clients.repository.ts  new  findClients, countClients, findClient, insertClient, updateOwnClient (companyId required; salesRepId filter optional)
src/features/clients/server/clients.service.ts     new  listClients, getClient, createClient, updateClient
src/features/clients/server/clients.routes.ts      new  listClientsHandler, createClientHandler, getClientHandler, updateClientHandler
src/features/clients/server/index.ts               new  public API (phase 4 will need getClient for ownership)
src/features/clients/client/clients.queries.ts     new  clientListOptions, clientDetailOptions, fetchers
src/features/clients/client/clients-page/clients-page.tsx  new  list + states; rep-only "إضافة عميل"; owner column for manager/accountant
src/features/clients/client/clients-page/use-clients-page.ts  new
src/features/clients/client/clients-page/index.ts           new
src/features/clients/client/clients-page/components/clients-table/clients-table.tsx  new
src/features/clients/client/clients-page/components/clients-table/index.ts           new
src/features/clients/client/client-details/client-details.tsx  new  notes as text child, whitespace-pre-wrap; edit link for SALES only
src/features/clients/client/client-details/index.ts            new
src/features/clients/client/client-form/client-form.tsx        new
src/features/clients/client/client-form/use-client-form.ts     new
src/features/clients/client/client-form/index.ts               new

# Routing (src/app); inside phase 2's authenticated route group if it makes one
src/app/units/page.tsx                    new  requireUser → parse → prefetch list → HydrationBoundary → <UnitsPage>
src/app/units/new/page.tsx                new  requireUser; non-manager → redirect("/units"); <UnitForm mode="create">
src/app/units/[id]/edit/page.tsx          new  requireUser; non-manager → redirect; prefetch detail; NOT_FOUND → notFound() (R8)
src/app/clients/page.tsx                  new  requireUser → parse → prefetch list → <ClientsPage>
src/app/clients/new/page.tsx              new  requireUser; non-SALES → redirect("/clients")
src/app/clients/[id]/page.tsx             new  prefetch detail; NOT_FOUND → notFound(); <ClientDetails>
src/app/clients/[id]/edit/page.tsx        new  requireUser; non-SALES → redirect; prefetch; NOT_FOUND → notFound()
src/app/api/units/route.ts                new  export { GET, POST } from units routes
src/app/api/units/[id]/route.ts           new  export { GET, PATCH }
src/app/api/clients/route.ts              new  export { GET, POST }
src/app/api/clients/[id]/route.ts         new  export { GET, PATCH }
<phase 2 nav component>                   change  + links "الوحدات" (all roles), "العملاء" (all roles)

# Tests
tests/unit/shared/lib/money.test.ts                    new
tests/unit/shared/lib/search-params.test.ts            new
tests/unit/shared/lib/form-errors.test.ts              new
tests/unit/features/units/units.schemas.test.ts        new
tests/unit/features/clients/clients.schemas.test.ts    new
tests/unit/architecture/conventions.test.ts            change  + "no dangerouslySetInnerHTML in src" (R10)
tests/integration/support/session-users.ts             new     makeSessionUser(companyId, role) → SessionUser built on db-fixtures
tests/integration/prisma/units-clients-checks.test.ts         new     new DB checks
tests/integration/features/units/server/units.service.test.ts       new
tests/integration/features/clients/server/clients.service.test.ts   new
tests/integration/features/units/server/units.routes.test.ts        new  (needs phase 2 session helper)
tests/integration/features/clients/server/clients.routes.test.ts    new  (needs phase 2 session helper)

# Docs
README.md                                 change  Assumptions (from spec) + Technical decisions (R1, R2, R3, R6)
```

**Structure Decision**: The AGENTS.md feature layout.
- `src/features/units` and `src/features/clients` each hold `<f>.schemas.ts`, `<f>.types.ts`, `<f>.keys.ts`, `server/` (routes → service → repository, plus `index.ts`) and `client/` (one folder per component, private children in `components/`, at most 2 levels).
- UI used by both features goes in `src/shared/components/`.
- `src/app` only routes.
- Tests mirror `src/` paths.

### Service flows (the only places with business rules)

- **`listUnits(user, query)`**: `releaseExpired(companyId)` → `findUnits` + `countUnits` (same filters) → `Page<UnitDto>`.
- **`getUnit(user, id)`**: `releaseExpired` → `findUnit(companyId, id)` → `null` → `NOT_FOUND`.
- **`createUnit(user, input)`**: role ≠ MANAGER → `FORBIDDEN`. Then `insertUnit(companyId, input)`. A unique violation → `VALIDATION_ERROR { number }`. No audit.
- **`updateUnit(user, id, input)`**: in `withTransaction`, run R1 steps 1–4. The audit row is written through phase 2's audit writer with `tx`. A unique violation, caught outside the transaction → `VALIDATION_ERROR { number }`.
- **`listClients(user, query)`**: SALES → filter `salesRepId = userId`; others → company only.
- **`getClient(user, id)`**: `findClient(companyId, id, salesRepId if SALES)` → `null` → `NOT_FOUND`.
- **`createClient(user, input)`**: role ≠ SALES → `FORBIDDEN`. Insert with `companyId` and `salesRepId` from the session.
- **`updateClient(user, id, input)`**: `findClient` scoped as in `getClient` → `null` → `NOT_FOUND`. Then role ≠ SALES → `FORBIDDEN`. Then `updateOwnClient(companyId, id, userId, input)` (`WHERE` includes `salesRepId`) → 0 rows → `NOT_FOUND`.

### UI states (FR-027, FR-028)

- **Loading**:
  - Lists: `isPending` → `TableSkeleton`.
  - Page changes: `isFetching && isPlaceholderData` → table dimmed.
- **Empty**: lists show `EmptyState` with an Arabic message. When filters are active, a "مسح الفلاتر" link is added.
- **Error**: `isError` → `ErrorState` with "إعادة المحاولة" (`refetch`). An invalid URL → `ErrorState` with a reset link (R4).
- **Forms**:
  - Field errors appear under each field, from the Zod resolver and from API 400 `fieldErrors` → `setError`.
  - A 409 (`UNIT_PRICE_LOCKED`, `UNIT_CHANGED`) or any other error → `setError("root")`, shown as an `Alert` at the top. A 409 also refetches the unit so the current status shows.
  - On success: a sonner toast, then navigate to the list.

## Requirement → proof map

"Auto" = an automated test. "Manual" = a step in [quickstart.md](./quickstart.md). "P2" = a route-level test that needs phase 2's session helper. Test names are the `it(...)` titles to use.

| Rule | Proof | Kind |
|---|---|---|
| FR-001 units of own company only | `tests/integration/features/units/server/units.service.test.ts` › "tenant isolation › lists only the session company's units" | Auto |
| FR-002 filter status / price range (inclusive), sort price/area both ways, pages | `units.service.test.ts` › "list › filters by status", "list › price range includes both ends", "list › sorts by area desc", "list › sorts by price asc" | Auto |
| FR-003 every invalid param → 400; default 20, max 50 | `tests/unit/features/units/units.schemas.test.ts` › "rejects <case>" (bad status, negative/decimal price, min > max, sort=rooms, order=up, page 0, pageSize 51, repeated key) and "applies defaults"; `units.routes.test.ts` › "returns 400 with fieldErrors for pageSize=51" | Auto + P2 |
| FR-004 default order + stable pages | `units.service.test.ts` › "list › default order is project then number", "list › pages with equal prices never repeat or skip" (page 1 ∪ page 2 = all, disjoint), "list › page past the end is empty with total" | Auto |
| FR-005 filters in the URL | quickstart §3 (refresh and shared link keep the view) | Manual |
| FR-006 correct status after expiry; sold never returns | `units.service.test.ts` › "expiry › expired reservation lists as AVAILABLE on next read", "expiry › active reservation stays RESERVED", "expiry › SOLD with expired reservation stays SOLD", "expiry › getUnit releases too" | Auto |
| FR-007 only manager adds; fields | `units.service.test.ts` › "role checks › SALES cannot create", "role checks › ACCOUNTANT cannot create", "create › manager creates AVAILABLE unit"; `units.schemas.test.ts` › field rules | Auto |
| FR-008 company + AVAILABLE regardless of request | `units.service.test.ts` › "create › ignores hand-sent status and companyId" (input parsed through `unitInputSchema` with extra keys) | Auto |
| FR-009 duplicate project + number → field error; other company OK | `units.service.test.ts` › "create › duplicate number gives fieldErrors.number", "create › same number in another company is allowed", "update › renaming to a taken number gives fieldErrors.number" | Auto |
| FR-010 only manager edits; non-price fields any status | `units.service.test.ts` › "role checks › SALES cannot update", "role checks › ACCOUNTANT cannot update", "update › SOLD unit: area change saved, no audit" | Auto |
| FR-011 price only while AVAILABLE; same price never refused | `units.service.test.ts` › "price lock › RESERVED unit price change → UNIT_PRICE_LOCKED, price unchanged", "price lock › SOLD unit → UNIT_PRICE_LOCKED", "price lock › expired reservation → change succeeds", "price lock › reserved after form opened → UNIT_PRICE_LOCKED" (status flipped between `getUnit` and `updateUnit`), "price lock › same price on RESERVED unit is saved" | Auto |
| R1 concurrent price edits (`UNIT_CHANGED`) | `units.service.test.ts` › "price lock › two concurrent price edits never share an oldPrice" (`Promise.all` of 2 `updateUnit` calls with different prices on one available unit: either one fails with `UNIT_CHANGED`, or both succeed and the second row's `oldPrice` = the first row's `newPrice`; the final price = the last successful call) | Auto |
| FR-012 audit old/new price in the same step; none on create or same price | `units.service.test.ts` › "audit › one PRICE_CHANGED with oldPrice/newPrice/userId/entityId", "audit › refused change writes no row", "audit › create writes no row", "audit › same price writes no row" | Auto |
| FR-013 status never settable | `tests/unit/features/units/units.schemas.test.ts` › "input strips status and companyId"; `units.service.test.ts` › "update › hand-sent status is ignored" | Auto |
| FR-014 rep adds client owned by self | `tests/integration/features/clients/server/clients.service.test.ts` › "create › owner and company come from the session" (input with a foreign `salesRepId`/`companyId`) | Auto |
| FR-015 rep edits own clients only | `clients.service.test.ts` › "ownership › rep edits own client", "ownership › rep editing another rep's client → NOT_FOUND, unchanged" | Auto |
| FR-016 rep sees own only | `clients.service.test.ts` › "ownership › rep list shows only own clients", "ownership › rep reading another rep's client → NOT_FOUND" | Auto |
| FR-017 manager + accountant see all company clients read-only, owner shown | `clients.service.test.ts` › "read-only roles › manager lists all company clients with salesRep", "read-only roles › accountant lists all company clients" | Auto |
| FR-018 client pages, order by name | `clients.service.test.ts` › "list › ordered by name then id, pageSize respected"; `tests/unit/features/clients/clients.schemas.test.ts` › "rejects pageSize 51" | Auto |
| FR-019 notes as plain text | `clients.service.test.ts` › "notes › HTML-like notes returned exactly as typed"; `tests/unit/architecture/conventions.test.ts` › "never uses dangerouslySetInnerHTML"; quickstart §5 | Auto + Manual |
| FR-020 duplicate phone allowed, nothing leaked | `clients.service.test.ts` › "create › duplicate phone across reps is accepted" | Auto |
| FR-021 server-side checks on every request | all "role checks" and "ownership" tests call the service directly (no UI); `*.routes.test.ts` › "403/404 through HTTP" | Auto + P2 |
| FR-022 other company → 404 for every read and edit | `units.service.test.ts` › "tenant isolation › getUnit of company B → NOT_FOUND for MANAGER, SALES, ACCOUNTANT", "tenant isolation › updateUnit of company B → NOT_FOUND for every role, unchanged"; `clients.service.test.ts` › same two for clients, plus "tenant isolation › client list excludes company B for MANAGER, SALES, ACCOUNTANT"; `*.routes.test.ts` › "GET /api/{units\|clients}?companyId={company B id} returns only company A rows" (spec US6 scenario 4) | Auto + P2 |
| FR-023 another rep's client → 404 | `clients.service.test.ts` › "ownership › rep reading another rep's client → NOT_FOUND" | Auto |
| FR-024 wrong role → 403 | `units.service.test.ts` › "role checks › …"; `clients.service.test.ts` › "role checks › MANAGER cannot create/update", "role checks › ACCOUNTANT cannot create/update" | Auto |
| FR-025 only reps write clients | same as FR-024 (clients) | Auto |
| FR-026 hand-sent company/owner/status ignored | FR-008, FR-013, FR-014 tests | Auto |
| FR-027 loading / empty / error states | quickstart §4 | Manual |
| FR-028 field errors next to fields; 409 at top | `tests/unit/shared/lib/form-errors.test.ts` › "maps 400 fieldErrors to each field", "maps 409 to root"; quickstart §4 | Auto + Manual |
| FR-029 Arabic RTL, mobile + desktop | quickstart §6 | Manual |
| FR-030 hidden actions per role | quickstart §2 | Manual |
| Money conversion exact, ≤ 2 decimals | `tests/unit/shared/lib/money.test.ts` › "parses 1500.5 to 150050", "rejects 3 decimals", "rejects negative / text / empty", "formats halalas as riyals" | Auto |
| Query normalization | `tests/unit/shared/lib/search-params.test.ts` › "empty string → undefined", "repeated key → array", "same result for URLSearchParams and record" | Auto |
| DB checks (R9) | `tests/integration/prisma/units-clients-checks.test.ts` › "rejects empty or untrimmed name", "rejects empty or untrimmed phone", "rejects price above 10^11 halalas", "accepts price of exactly 10^11 halalas" | Auto |
| Phone format, notes length, field limits | `clients.schemas.test.ts` › "accepts +966 50-000-0000", "rejects letters", "rejects 6 and 21 chars", "notes over 2000 rejected", "empty notes → null"; `units.schemas.test.ts` › "rejects area 0 / 100001, rooms 51, price 0" | Auto |
| Spec "done when": A cannot read/edit B units or clients; rep cannot read another rep's client; reserved unit price cannot change | FR-022, FR-023, FR-011 rows above | Auto |

Tests that create a reserved unit or an expired reservation use `makeReservation` from `tests/integration/support/db-fixtures.ts`. The test then sets `units.status` / `expires_at` directly, because reservations arrive in phase 4 (spec Assumptions).

## Complexity Tracking

No constitution violations. Nothing to justify.
