---

description: "Task list for phase 3: units and clients"
---

# Tasks: Units and Clients

**Input**: Design documents from `specs/004-unit-client-management/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. The spec's "Done when" asks for integration tests (company isolation, another rep's client, reserved-unit price). Constitution I also requires a cross-company test. Every rule in [plan.md › Requirement → proof map](./plan.md#requirement--proof-map) has a test task below. Use the `it(...)` titles from that map. Write each test task first and confirm it fails before writing the code that makes it pass.

**Organization**: Tasks are grouped by the user stories in spec.md (US1–US6).

**Hard gate**: Phase 2 (authentication and app shell) must be merged into `main` before T003. T001 checks this.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1–US6)
- Every task names its file path. Paths are from the repository root.

## Rules for every task (from AGENTS.md; do not repeat them in code reviews)

- **Server files**:
  - Every file under `src/server/` and `src/features/*/server/` starts with `import "server-only";`.
  - Only `*.repository.ts` and `src/server/db.ts` import Prisma.
- **Repositories**:
  - Every repository function takes `companyId` as a required argument, plus an optional `tx`.
  - Services never call Prisma directly; they use `withTransaction` from `src/server/db.ts`.
- **Session**: `companyId` and `userId` come only from `SessionUser` (phase 2), never from the body, query or params.
- **Money**:
  - Money is `bigint` halalas in the database and an integer `number` in DTOs, query and body.
  - Conversion happens only in `src/shared/lib/money.ts`.
- **Naming and layout**:
  - All names are kebab-case.
  - One folder per component (`name.tsx`, optional `use-name.ts`, `index.ts` exporting only the component). No empty files.
- **RTL**: only logical CSS classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
- **Commits**: after each task (or a small group), one small Conventional Commit (`feat:`, `fix:`, `test:`, `docs:`).

---

## Phase 1: Setup

**Purpose**: Confirm the dependencies exist and record the real names phase 2 chose.

- [X] T001 Check that `main` has phase 2 merged: `git log main` shows the phase 2 merge, and `src/server/auth/` exists on `main`. If it does not, STOP and report "blocked on phase 2". Otherwise run `git rebase main` on this branch.
- [X] T002 Read phase 2's code and fill in the real names in `specs/004-unit-client-management/plan.md` (section "Source Code", replacing the `P2?` markers and `<phase 2 nav component>`) and in `specs/004-unit-client-management/research.md` R11. The names to find:
  - the `requireUser()` import path and its `SessionUser` type;
  - how `handleRoute({ auth: "user" })` passes the user to the handler;
  - the audit writer function and its file;
  - the navigation component file;
  - the integration-test helper that gives a valid session cookie;
  - which of `button`, `input`, `label` (in `src/shared/components/ui/`) and `src/shared/lib/api-client.ts` already exist.

  Commit `docs: record phase 2 interfaces for phase 3`.
- [ ] T003 Run `npm ci`, then `DATABASE_URL=postgresql://aqar:aqar@localhost:5433/aqar npm run db:generate`, `npm run lint && npm run typecheck && npm run test`, `docker compose up -d db` and `npm run test:integration`. All must pass before any change. This is the baseline.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Shared code and the one schema change that every story needs.

**⚠️ No user-story task starts before this phase is done.**

### Tests first

- [x] T004 [P] Write `tests/integration/prisma/units-clients-checks.test.ts`: "rejects empty or untrimmed name" and "rejects empty or untrimmed phone" (insert through `getDb().client.create` with `"  "`, `""` and `" x"`), "rejects price above 10^11 halalas" (`makeUnit` with `price: 100_000_000_001n`) and "accepts price of exactly 10^11 halalas". Assert `expectDbError(…, { code: "23514", constraint: "clients_name_check" | "clients_phone_check" | "units_price_max_check" })` using `tests/integration/support/db-fixtures.ts`.
- [x] T005 [P] Write `tests/unit/shared/lib/money.test.ts`. For `parseRiyals`:
  - `"1500"` → 150000, `"1500.5"` → 150050, `"1500.05"` → 150005, `"0.01"` → 1;
  - `"1500.555"`, `"-1"`, `"abc"`, `""`, `" "`, `"1e3"` → `null`.

  For `formatRiyals`: 150050 shows the Arabic-formatted riyals with 2 decimals.

  For `toRiyalText`: 150050 → `"1500.5"`, 150000 → `"1500"`, 5 → `"0.05"`, and it round-trips through `parseRiyals`.
- [x] T006 [P] Write `tests/unit/shared/lib/search-params.test.ts` for `toQueryInput`: "empty string → undefined", "repeated key → array", "same result for URLSearchParams and record".
- [X] T007 [P] Write `tests/unit/shared/lib/form-errors.test.ts` for `applyApiError(err, setError)` with a stub `setError`: "maps 400 fieldErrors to each field" and "maps 409 to root". A non-`ApiError` → root with the generic message.
- [x] T008 [P] Add the case "never uses dangerouslySetInnerHTML" to `tests/unit/architecture/conventions.test.ts`. It walks `src/` (using the existing `walk`) and fails if any `.ts`/`.tsx` file contains `dangerouslySetInnerHTML`.

### Implementation

- [x] T009 Create the migration with `DATABASE_URL=postgresql://aqar:aqar@localhost:5433/aqar npx prisma migrate dev --create-only --name units_clients_checks`. Write in `prisma/migrations/<timestamp>_units_clients_checks/migration.sql`:
  - `ALTER TABLE "clients" ADD CONSTRAINT "clients_name_check" CHECK ("name" = btrim("name") AND "name" <> '');`
  - the same for `"phone"` as `clients_phone_check`;
  - `ALTER TABLE "units" ADD CONSTRAINT "units_price_max_check" CHECK ("price" <= 100000000000);`

  Apply it. `schema.prisma` does not change. T004 must pass.
- [x] T010 [P] Add `UNIT_PRICE_LOCKED: 409` and `UNIT_CHANGED: 409` to `src/server/http/error-codes.ts`. Add their Arabic messages (exact text in contracts/units-api.md › New error codes) to `src/shared/lib/error-messages.ts`.
- [x] T011 [P] Add `isUniqueViolation(err: unknown, constraint: string): boolean` to `src/server/db.ts`. It returns true when `err` is a Prisma known request error with code `P2002` and the constraint name appears in its metadata or message. Handle the driver-adapter shape seen in `tests/integration/support/db-fixtures.ts` › `expectDbError` (research R6).
- [x] T012 [P] Create `src/shared/lib/money.ts` with `parseRiyals(text: string): number | null`, `formatRiyals(halalas: number): string` and `toRiyalText(halalas: number): string` (plain digits for an input field) (research R5).
  - Split the string on "." and use integer arithmetic only, with no `parseFloat`.
  - Regex `^\d+(\.\d{1,2})?$` after trimming.
  - Format with `Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2 })`.

  T005 must pass.
- [x] T013 [P] Create `src/shared/lib/search-params.ts` with `toQueryInput(source: URLSearchParams | Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined>` (research R4). T006 must pass.
- [x] T014 [P] Create `src/shared/lib/pagination.ts`:
  - a `digits` schema: `z.string().regex(/^\d+$/)` piped to a number;
  - `paginationFields` = `{ page: digits → int ≥ 1, default 1; pageSize: digits → int 1–50, default 20 }`;
  - `type Page<T> = { items: T[]; total: number; page: number; pageSize: number }`;
  - `toSkip(page, pageSize)`.

  Export `digits` for the units price filters.
- [X] T015 [P] Create `src/shared/lib/api-client.ts`, only if T002 found it missing. It has `class ApiError extends Error { status; code; fieldErrors? }` and `apiFetch<T>(url, init?)`, which sends JSON, returns `body.data`, and throws `ApiError` from `body.error`.
- [X] T016 Create `src/shared/lib/form-errors.ts` with `applyApiError(err: unknown, setError)`:
  - `ApiError` with status 400 and `fieldErrors` → `setError(field, { message })` for each field;
  - anything else → `setError("root", { message })`, using `err.message` or the generic Arabic message.

  It depends on T015 or phase 2's `ApiError`. T007 must pass.
- [X] T017 [P] Add the UI primitives to `src/shared/components/ui/` with the shadcn CLI and the existing `components.json` (research R7): `npx shadcn@4.23.0 add textarea native-select table badge skeleton alert`. Reuse phase 2's `button`, `input` and `label`; do not regenerate them. If the CLI wants any package other than the already-installed `radix-ui`, stop and ask. Check that the generated files use logical classes only (no `ml-`/`mr-`/`left-`/`right-`), and fix them if not.
- [X] T018 [P] Create `src/shared/components/money-input/money-input.tsx` and `index.ts` (research R5):
  - a client component;
  - props `{ value: number | undefined; onChange(halalas: number): void; id; name; disabled?; aria-invalid? }`;
  - keeps the riyal text in `useState`;
  - calls `onChange(parseRiyals(text) ?? NaN)`;
  - when `value` changes from outside (edit form defaults, filter reset), shows it with `toRiyalText(value)`, for example `1500.5`.
- [X] T019 [P] Create `src/shared/components/pagination-nav/pagination-nav.tsx` and `index.ts`:
  - props `{ page, pageSize, total, onPageChange(page) }`;
  - "السابق" and "التالي" buttons, disabled at the ends;
  - the text "صفحة X من Y" (Y ≥ 1).
- [X] T020 [P] Create `src/shared/components/empty-state/empty-state.tsx` and `index.ts` (props `{ message; action?: ReactNode }`). Create `src/shared/components/error-state/error-state.tsx` and `index.ts` (props `{ message; onRetry?; resetHref? }`, showing "إعادة المحاولة" and/or "مسح الفلاتر"). Create `src/shared/components/table-skeleton/table-skeleton.tsx` and `index.ts` (props `{ rows?; columns }`).
- [X] T021 [P] Create `tests/integration/support/session-users.ts`:
  - `makeSessionUser(companyId, role)` calls `makeUser` from `db-fixtures.ts` and returns phase 2's `SessionUser`;
  - `makeTwoCompanies()` returns company A and company B, each with a MANAGER, an ACCOUNTANT and 2 SALES `SessionUser`s.
- [x] T022 [P] Create `src/features/units/units.schemas.ts`:
  - `unitSchema`: z.object with field rules defined once, from data-model.md › Unit (trimmed strings with Arabic messages, `type` enum, `area` int 1–100000, `rooms` int 0–50, `price` int 1–100_000_000_000, plus `id` and `status` for DTO typing).
  - `unitInputSchema = unitSchema.pick({ projectName, number, type, area, rooms, price })`.
  - `unitListQuerySchema`: `status?`, `minPrice?`/`maxPrice?` using `digits` from pagination.ts, `sort?` `price|area`, `order` `asc|desc` default `asc`, `...paginationFields`, with `.refine(min ≤ max, { path: ["minPrice"] })`.
  - `unitIdSchema = z.uuid()`.
  - `UNIT_NUMBER_TAKEN = "رقم الوحدة مستخدم في هذا المشروع"`.
  - No `companyId` anywhere and no `.omit()`.
- [x] T023 [P] Write `tests/unit/features/units/units.schemas.test.ts`: "input strips status and companyId", "applies defaults" (page 1, pageSize 20, order asc), and "rejects …" for each of:
  - status=`FOO`, minPrice=`-1`, minPrice=`1.5`, minPrice=`1e3`, minPrice=`" "`
  - minPrice>maxPrice, sort=`rooms`, order=`up`, page=`0`, pageSize=`51`, a repeated `status` key (array)
  - area 0, area 100001, area 1.5, rooms 51, price 0, an empty projectName, a projectName of 101 chars

  Also "trims projectName" and "ignores unknown params". It must pass against T022.
- [x] T024 [P] Create `src/features/units/units.types.ts` (`UnitDto` per data-model.md › DTOs; `UnitInput = z.infer<typeof unitInputSchema>`; `UnitListQuery = z.infer<typeof unitListQuerySchema>`; `UnitPage = Page<UnitDto>`) and `src/features/units/units.keys.ts` (`unitKeys.all = ["units"]`, `list(query)`, `detail(id)`).
- [x] T025 [P] Create `src/features/units/client/unit-labels.ts`: Arabic labels for `UnitType` (شقة، فيلا، تاون هاوس، دوبلكس) and `UnitStatus` (متاحة، محجوزة، مباعة), plus a badge variant per status.

**Checkpoint**: `npm run lint && npm run typecheck && npm run test` and `npm run test:integration` pass. Shared code is ready.

---

## Phase 3: User Story 1 - Browse the company's units (Priority: P1) 🎯 MVP

**Goal**: Any staff user lists their company's units, with server-side status and price-range filters, sorting by price or area, pages, the view kept in the URL, and statuses always correct.

**Independent Test**: As any seed user, open `/units`, filter, sort and page. Only own-company units show, and a unit with an expired reservation shows as available (quickstart §3, §4).

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [ ] T026 [US1] Write `tests/integration/features/units/server/units.service.test.ts` with these describe blocks, using `makeTwoCompanies` (T021) and `makeUnit`/`makeReservation`/`makeClient` (db-fixtures):
  - **"list"**: "filters by status", "price range includes both ends", "sorts by area desc", "sorts by price asc", "default order is project then number", "pages with equal prices never repeat or skip" (5 units with the same price; page 1 + page 2 with pageSize 3 are disjoint and together equal all), "page past the end is empty with total".
  - **"expiry"**: "expired reservation lists as AVAILABLE on next read" (unit RESERVED + reservation `expiresAt` in the past, set with `getDb().reservation.update`), "active reservation stays RESERVED", "SOLD with expired reservation stays SOLD", "getUnit releases too".
  - **"tenant isolation"**: "lists only the session company's units".
- [ ] T027 [P] [US1] Write `tests/integration/features/units/server/units.routes.test.ts` › "GET /api/units returns 400 with fieldErrors for pageSize=51" and "… for minPrice > maxPrice". It calls the exported `GET` from `src/app/api/units/route.ts` with a `Request` that carries the session cookie from phase 2's test helper (T002), and asserts the `{ error: { code: "VALIDATION_ERROR", fieldErrors } }` shape.

### Implementation for User Story 1

- [x] T028 [US1] Create `src/features/units/server/units.repository.ts` with:
  - `releaseExpired(companyId, tx?)`: the one `$executeRaw` tagged-template UPDATE from research R2, using DB `now()`. Add `::uuid` on `${companyId}` if the T026 expiry tests fail with `uuid = text`.
  - `findUnits(companyId, query, tx?)`: a `where` built from status and the price range (`gte`/`lte` as `BigInt`); `orderBy` per research R12, always ending in `{ id: "asc" }`; `skip`/`take` from `toSkip`.
  - `countUnits(companyId, query, tx?)`: the same `where`.
  - `findUnit(companyId, id, tx?)`: `findFirst({ where: { id, companyId } })`.
- [ ] T029 [US1] Create `src/features/units/server/units.service.ts` with:
  - `toUnitDto(row)`: `price: Number(row.price)`; no `companyId` in the DTO;
  - `listUnits(user: SessionUser, query: UnitListQuery): Promise<UnitPage>`: `releaseExpired`, then `findUnits` and `countUnits` in parallel;
  - `getUnit(user, id): Promise<UnitDto>`: `releaseExpired`, then `findUnit`; `null` → `throw new AppError("NOT_FOUND")`.

  T026 must pass.
- [ ] T030 [US1] Create `src/features/units/server/units.routes.ts`:
  - `listUnitsHandler = handleRoute({ auth: "user", handler })`: parses `unitListQuerySchema.parse(toQueryInput(new URL(req.url).searchParams))`, then calls `listUnits`;
  - `getUnitHandler`: `unitIdSchema.safeParse(params.id)`; failure → `AppError("NOT_FOUND")`; then `getUnit`.

  Create `src/features/units/server/index.ts` exporting `listUnits`, `getUnit`, `releaseExpired` and the handlers.
- [ ] T031 [P] [US1] Create `src/app/api/units/route.ts` (`export { listUnitsHandler as GET } from "@/features/units/server"`) and `src/app/api/units/[id]/route.ts` (`export { getUnitHandler as GET }`). T027 must pass.
- [ ] T032 [P] [US1] Create `src/features/units/client/units.queries.ts`:
  - `unitListOptions(query)` = `queryOptions({ queryKey: unitKeys.list(query), queryFn: () => apiFetch<UnitPage>("/api/units?" + params) })`, which builds params only from defined query values;
  - `unitDetailOptions(id)` the same way, with `unitKeys.detail(id)`.
- [ ] T033 [P] [US1] Create `src/features/units/client/units-page/components/unit-status-badge/unit-status-badge.tsx` and `index.ts` (a `Badge` with the label and variant from `unit-labels.ts`).
- [ ] T034 [P] [US1] Create `src/features/units/client/units-page/components/units-table/units-table.tsx` and `index.ts`:
  - props `{ units: UnitDto[]; canEdit: boolean; dimmed: boolean }`;
  - shadcn `Table` with columns: project, number, type, area (م²), rooms, price (`formatRiyals`), status (`UnitStatusBadge`), and an edit link to `/units/{id}/edit` only when `canEdit`;
  - wrapped in `overflow-x-auto`.
- [ ] T035 [P] [US1] Create `src/features/units/client/units-page/components/units-filters/units-filters.tsx` and `index.ts`:
  - props `{ query: UnitListQuery; onApply(next: Partial<UnitListQuery>) }`;
  - a status `NativeSelect` (with "الكل"), `MoneyInput` for min and max price, a sort select ("بدون"/السعر/المساحة) and an order select;
  - "تطبيق" and "مسح" buttons.
- [ ] T036 [US1] Create `src/features/units/client/units-page/use-units-page.ts`:
  - reads `useSearchParams()`, then `toQueryInput` and `unitListQuerySchema.safeParse`;
  - `useQuery({ ...unitListOptions(query), placeholderData: keepPreviousData, enabled: parse.success })`;
  - `setFilters(next)` writes the URL with `router.push` and resets `page` to 1;
  - `setPage(p)`.
- [ ] T037 [US1] Create `src/features/units/client/units-page/units-page.tsx` and `index.ts`:
  - a client component with props `{ role }`;
  - invalid URL → `ErrorState` with `resetHref="/units"`;
  - `isPending` → `TableSkeleton`; `isError` → `ErrorState` with `onRetry={refetch}`;
  - empty → `EmptyState` ("لا توجد وحدات مطابقة", with a clear-filters link when filters are set);
  - otherwise `UnitsFilters` + `UnitsTable` (`dimmed` when `isPlaceholderData`) + `PaginationNav`;
  - a title of "الوحدات".
- [ ] T038 [US1] Create `src/app/(app)/units/page.tsx` (phase 2's authenticated route group):
  - `const user = await requireUser()`;
  - `const parsed = unitListQuerySchema.safeParse(toQueryInput(await searchParams))`;
  - if successful, `await queryClient.prefetchQuery({ queryKey: unitKeys.list(parsed.data), queryFn: () => listUnits(user, parsed.data) })` with `getQueryClient()`;
  - return `<HydrationBoundary state={dehydrate(queryClient)}><UnitsPage role={user.role} /></HydrationBoundary>`.
- [ ] T039 [US1] Add a "الوحدات" link (all roles) to the phase 2 navigation component named in T002.

**Checkpoint**: US1 works alone. T026 and T027 pass, and quickstart §3 is OK.

---

## Phase 4: User Story 2 - Manager adds a unit (Priority: P1)

**Goal**: A manager creates a unit that is always AVAILABLE and in their own company. A duplicate project + number is a field error. Other roles are refused.

**Independent Test**: As a manager, add a unit and see it listed as available. As an accountant, a POST with a valid body gets 403 (quickstart §2, §4.4).

### Tests for User Story 2 ⚠️

- [ ] T040 [US2] Add to `tests/integration/features/units/server/units.service.test.ts`:
  - **"create"**: "manager creates AVAILABLE unit", "ignores hand-sent status and companyId" (pass `unitInputSchema.parse({ ...valid, status: "SOLD", companyId: B })`), "duplicate number gives fieldErrors.number" (expect `AppError` `VALIDATION_ERROR` with `fieldErrors.number[0] === UNIT_NUMBER_TAKEN`), "same number in another company is allowed".
  - **"role checks"**: "SALES cannot create", "ACCOUNTANT cannot create" (`FORBIDDEN`, no row added).
  - **"audit"**: "create writes no row" (count of `audit_logs` rows for the company is unchanged).
- [ ] T041 [P] [US2] Add to `tests/integration/features/units/server/units.routes.test.ts`: "POST /api/units with a valid body as ACCOUNTANT returns 403" and "POST with a foreign Origin returns 403 INVALID_ORIGIN".

### Implementation for User Story 2

- [x] T042 [US2] Add `insertUnit(companyId, input: UnitInput, tx?)` to `src/features/units/server/units.repository.ts`. It runs `create` with `{ ...input, price: BigInt(input.price), companyId }` and never takes `status`.
- [ ] T043 [US2] Add `createUnit(user, input)` to `src/features/units/server/units.service.ts`:
  - `user.role !== "MANAGER"` → `FORBIDDEN`;
  - `try insertUnit`;
  - `catch`: `isUniqueViolation(err, "units_company_id_project_name_number_key")` → `AppError("VALIDATION_ERROR", { number: [UNIT_NUMBER_TAKEN] })`, otherwise rethrow.

  T040 must pass.
- [ ] T044 [US2] Add `createUnitHandler` to `src/features/units/server/units.routes.ts` (`unitInputSchema.parse(await readJson(req))` → `createUnit` → `{ data, status: 201 }`). Export it from `server/index.ts`. Add `export { createUnitHandler as POST }` to `src/app/api/units/route.ts`. T041 must pass.
- [ ] T045 [US2] Create `src/features/units/client/unit-form/use-unit-form.ts`:
  - `useForm<UnitInput>({ resolver: zodResolver(unitInputSchema), defaultValues })`;
  - `useMutation` POSTing to `/api/units` with `apiFetch`;
  - `onSuccess`: `invalidateQueries({ queryKey: unitKeys.all })`, a `toast.success("تمت إضافة الوحدة")`, then `router.push("/units")`;
  - `onError`: `applyApiError(err, form.setError)`.

  Structure it so T052 can add edit mode (`mode: "create" | "edit"`, `unit?: UnitDto`).
- [ ] T046 [US2] Create `src/features/units/client/unit-form/unit-form.tsx` and `index.ts`:
  - fields: projectName, number (`Input`), type (`NativeSelect` with `unit-labels.ts`), area and rooms (`Input type="number"` with `valueAsNumber`), price (`MoneyInput` via `Controller`);
  - each field has a `Label` and its error message under it;
  - a `root` error shows as an `Alert` at the top;
  - the submit button is disabled while pending.
- [ ] T047 [US2] Create `src/app/(app)/units/new/page.tsx`: `requireUser()`; `role !== "MANAGER"` → `redirect("/units")`; render `<UnitForm mode="create" />`.
- [ ] T048 [US2] In `src/features/units/client/units-page/units-page.tsx`, show an "إضافة وحدة" link (`buttonVariants`) to `/units/new` only when `role === "MANAGER"`.

**Checkpoint**: US1 + US2 work. T040 and T041 pass.

---

## Phase 5: User Story 3 - Manager edits a unit and its price (Priority: P1)

**Goal**: A manager edits a unit. The price changes only while the unit is AVAILABLE, with one audit row holding the old and new price. Other fields can be edited in any status.

**Independent Test**: Change the price of an available unit (one audit row), then of a reserved unit (409, unchanged, no audit) (quickstart §4.5).

### Tests for User Story 3 ⚠️

- [ ] T049 [US3] Add to `tests/integration/features/units/server/units.service.test.ts`:
  - **"price lock"**:
    - "RESERVED unit price change → UNIT_PRICE_LOCKED, price unchanged";
    - "SOLD unit → UNIT_PRICE_LOCKED";
    - "expired reservation → change succeeds";
    - "reserved after form opened → UNIT_PRICE_LOCKED" (call `getUnit`, then set `status = 'RESERVED'` with an active reservation, then `updateUnit`);
    - "same price on RESERVED unit is saved" (area changes, price equal);
    - "two concurrent price edits never share an oldPrice" (`Promise.all` of 2 `updateUnit` calls on one AVAILABLE unit with prices P1 ≠ P2. Each call either succeeds or fails with `UNIT_CHANGED`. The `PRICE_CHANGED` rows have distinct `meta.oldPrice`. If 2 rows exist, the second `oldPrice` equals the first `newPrice`. The final DB price equals the `newPrice` of the last row).
  - **"audit"**: "one PRICE_CHANGED with oldPrice/newPrice/userId/entityId", "refused change writes no row", "same price writes no row".
  - **"update"**: "SOLD unit: area change saved, no audit", "hand-sent status is ignored", "renaming to a taken number gives fieldErrors.number".
  - **"role checks"**: "SALES cannot update", "ACCOUNTANT cannot update" (`FORBIDDEN`, record unchanged).
- [ ] T050 [P] [US3] Add to `tests/integration/features/units/server/units.routes.test.ts`: "PATCH reserved unit with a new price returns 409 UNIT_PRICE_LOCKED" and "PATCH with a valid body as SALES returns 403".

### Implementation for User Story 3

- [x] T051 [US3] Add two functions to `src/features/units/server/units.repository.ts`:
  - `updateUnitDetails(companyId, id, fields: Pick<UnitInput, "projectName" | "number" | "type" | "area" | "rooms">, tx?)`: `updateMany({ where: { id, companyId }, data: { projectName, number, type, area, rooms } })` → count.
  - `updateUnitPriceIfAvailable(companyId, id, input: UnitInput, oldPrice: bigint, tx?)`: `updateMany({ where: { id, companyId, status: "AVAILABLE", price: oldPrice }, data: { ...fields, price: BigInt(input.price) } })` → count.
- [ ] T052 [US3] Add `updateUnit(user, id, input)` to `src/features/units/server/units.service.ts`, following research R1 exactly. Run `withTransaction(async (tx) => …)`:
  1. `releaseExpired(companyId, tx)`;
  2. `findUnit` → `null` → `NOT_FOUND`;
  3. role ≠ MANAGER → `FORBIDDEN`;
  4. `BigInt(input.price) === unit.price` → `updateUnitDetails`;
  5. otherwise `updateUnitPriceIfAvailable`:
     - count 1 → write the audit row through phase 2's audit writer with `tx`: `{ companyId, userId, action: "PRICE_CHANGED", entityId: id, meta: { oldPrice: Number(unit.price), newPrice: input.price } }`;
     - count 0 → re-read with `findUnit`: `null` → `NOT_FOUND`; `status !== "AVAILABLE"` → `UNIT_PRICE_LOCKED`; else `UNIT_CHANGED`.

  Return `toUnitDto` of the re-read row. Wrap the whole transaction in `try/catch` for the duplicate number, as in T043. T049 must pass.
- [ ] T053 [US3] Add `updateUnitHandler` to `src/features/units/server/units.routes.ts`: `unitIdSchema` failure → `NOT_FOUND`, then `unitInputSchema.parse(await readJson(req))`, then `updateUnit`. Export it from `server/index.ts`. Add `export { updateUnitHandler as PATCH }` to `src/app/api/units/[id]/route.ts`. T050 must pass.
- [ ] T054 [US3] Extend `src/features/units/client/unit-form/use-unit-form.ts` and `unit-form.tsx` for `mode="edit"`:
  - `defaultValues` from `useQuery(unitDetailOptions(id))`;
  - PATCH to `/api/units/{id}`;
  - on success, invalidate `unitKeys.all` and show the toast "تم حفظ التعديلات";
  - when `unit.status !== "AVAILABLE"`, render the price `MoneyInput` as `disabled`, with the hint "لا يمكن تغيير السعر لأن الوحدة محجوزة أو مباعة";
  - on a 409 (`UNIT_PRICE_LOCKED` / `UNIT_CHANGED`), call `applyApiError` (root alert) and `refetch()` the detail query, so the current status and price show.
- [ ] T055 [US3] Create `src/app/(app)/units/[id]/edit/page.tsx`:
  - `requireUser()`; `role !== "MANAGER"` → `redirect("/units")`;
  - `unitIdSchema.safeParse(id)` failure → `notFound()`;
  - `prefetchQuery({ queryKey: unitKeys.detail(id), queryFn: () => getUnit(user, id) })`;
  - `queryClient.getQueryState(unitKeys.detail(id))?.error` is an `AppError` with code `NOT_FOUND` → `notFound()` (research R8);
  - render `HydrationBoundary` + `<UnitForm mode="edit" id={id} />`.
- [ ] T056 [US3] In `src/features/units/client/units-page/units-page.tsx`, pass `canEdit={role === "MANAGER"}` to `UnitsTable`, so the edit link shows for managers only.

**Checkpoint**: US1–US3 work. Units are complete, and all units tests pass.

---

## Phase 6: User Story 4 - Sales rep manages their own clients (Priority: P1)

**Goal**: A sales rep adds, lists, opens and edits only their own clients. Notes show as plain text.

**Independent Test**: As sales1, add a client, open it and edit it. As sales2, the same client's URL is 404 (quickstart §5, §6).

### Tests for User Story 4 ⚠️

- [x] T057 [P] [US4] Create `src/features/clients/clients.schemas.ts`:
  - `clientSchema` with fields defined once from data-model.md › Client: name trimmed 1–100; phone trimmed `^\+?[0-9][0-9 -]{5,18}$`; notes trimmed max 2000, with `""` → `null`;
  - `clientInputSchema = clientSchema.pick({ name, phone, notes })`;
  - `clientListQuerySchema = z.object({ ...paginationFields })`;
  - `clientIdSchema = z.uuid()`.

  Create `src/features/clients/clients.types.ts` (`ClientDto`, `ClientInput`, `ClientListQuery`, `ClientPage`) and `src/features/clients/clients.keys.ts` (`clientKeys.all`, `list`, `detail`).
- [x] T058 [P] [US4] Write `tests/unit/features/clients/clients.schemas.test.ts`: "accepts +966 50-000-0000", "accepts 0500000000", "rejects letters", "rejects 6 and 21 chars", "notes over 2000 rejected", "empty notes → null", "keeps line breaks in notes", "input strips salesRepId and companyId", "rejects pageSize 51", "rejects page 0".
- [ ] T059 [US4] Write `tests/integration/features/clients/server/clients.service.test.ts`, using `makeTwoCompanies`:
  - **"create"**: "owner and company come from the session" (input parsed with a foreign `salesRepId`/`companyId`), "duplicate phone across reps is accepted".
  - **"ownership"**: "rep list shows only own clients", "rep reading another rep's client → NOT_FOUND", "rep edits own client", "rep editing another rep's client → NOT_FOUND, unchanged".
  - **"list"**: "ordered by name then id, pageSize respected".
  - **"notes"**: "HTML-like notes returned exactly as typed" (notes `"<b>مهم</b>\n<script>alert(1)</script>"`).
- [ ] T060 [P] [US4] Write `tests/integration/features/clients/server/clients.routes.test.ts`: "GET /api/clients/{other rep's id} as SALES returns 404" and "POST /api/clients with a valid body returns 201 with salesRep = session user".

### Implementation for User Story 4

- [x] T061 [US4] Create `src/features/clients/server/clients.repository.ts`. Every function selects `salesRep: { select: { id, name } }`:
  - `findClients(companyId, { salesRepId? }, page, pageSize, tx?)`: `orderBy [{ name: "asc" }, { id: "asc" }]`;
  - `countClients(companyId, { salesRepId? }, tx?)`;
  - `findClient(companyId, id, salesRepId?, tx?)`;
  - `insertClient(companyId, salesRepId, input, tx?)`;
  - `updateOwnClient(companyId, id, salesRepId, input, tx?)`: `updateMany` with `where { id, companyId, salesRepId }` → count.
- [ ] T062 [US4] Create `src/features/clients/server/clients.service.ts`:
  - `toClientDto`;
  - `scopeFor(user)` = `user.role === "SALES" ? user.userId : undefined`;
  - `listClients(user, query)`, `getClient(user, id)` (`null` → `NOT_FOUND`);
  - `createClient(user, input)`: role ≠ SALES → `FORBIDDEN`; then insert with `user.companyId` and `user.userId`;
  - `updateClient(user, id, input)`: `findClient` with `scopeFor` → `null` → `NOT_FOUND`; then role ≠ SALES → `FORBIDDEN`; then `updateOwnClient` → 0 → `NOT_FOUND`; then return the re-read DTO.

  T059 must pass.
- [ ] T063 [US4] Create `src/features/clients/server/clients.routes.ts` (`listClientsHandler`, `createClientHandler` returning status 201, `getClientHandler`, `updateClientHandler`; a non-UUID id → `NOT_FOUND`; body via `clientInputSchema.parse(await readJson(req))`; query via `toQueryInput`). Create `src/features/clients/server/index.ts` exporting the service functions and handlers.
- [ ] T064 [P] [US4] Create `src/app/api/clients/route.ts` (`GET`, `POST`) and `src/app/api/clients/[id]/route.ts` (`GET`, `PATCH`) as re-exports only. T060 must pass.
- [ ] T065 [P] [US4] Create `src/features/clients/client/clients.queries.ts` (`clientListOptions(query)`, `clientDetailOptions(id)` via `queryOptions` + `apiFetch`).
- [ ] T066 [P] [US4] Create `src/features/clients/client/clients-page/components/clients-table/clients-table.tsx` and `index.ts`:
  - props `{ clients: ClientDto[]; showOwner: boolean; dimmed: boolean }`;
  - columns: name (a link to `/clients/{id}`), phone (`dir="ltr"`), and owner (`salesRep.name`) only when `showOwner`;
  - wrapped in `overflow-x-auto`.
- [ ] T067 [US4] Create `src/features/clients/client/clients-page/use-clients-page.ts` and `clients-page.tsx` + `index.ts`. They follow the same pattern as T036/T037: URL page and pageSize, `keepPreviousData`, loading/empty ("لا يوجد عملاء")/error states, `PaginationNav`, and an "إضافة عميل" link only when `role === "SALES"`.
- [ ] T068 [P] [US4] Create `src/features/clients/client/client-details/client-details.tsx` and `index.ts`:
  - `useQuery(clientDetailOptions(id))` with loading and error states;
  - shows name, phone (`dir="ltr"`) and notes as `<p className="whitespace-pre-wrap">{client.notes}</p>` (a text child only), or "لا توجد ملاحظات";
  - an "تعديل" link only when `role === "SALES"`.
- [ ] T069 [US4] Create `src/features/clients/client/client-form/use-client-form.ts` and `client-form.tsx` + `index.ts`:
  - create and edit modes, using `zodResolver(clientInputSchema)`;
  - fields name, phone (`dir="ltr"`) and notes (`Textarea`), each with its error under it, and a root `Alert`;
  - on success, invalidate `clientKeys.all`, show a toast, then `router.push("/clients/{id}")`.
- [ ] T070 [US4] Create the client pages:
  - `src/app/(app)/clients/page.tsx`: same pattern as T038, with `listClients` and `clientKeys.list`.
  - `src/app/(app)/clients/new/page.tsx`: `role !== "SALES"` → `redirect("/clients")`.
  - `src/app/(app)/clients/[id]/page.tsx`: prefetch `getClient`; `NOT_FOUND` → `notFound()`, as in T055.
  - `src/app/(app)/clients/[id]/edit/page.tsx`: `role !== "SALES"` → `redirect("/clients")`; prefetch; `NOT_FOUND` → `notFound()`.
- [ ] T071 [US4] Add a "العملاء" link (all roles) to the phase 2 navigation component.

**Checkpoint**: The sales rep client flow works alone. T058–T060 pass.

---

## Phase 7: User Story 5 - Manager and accountant view clients read-only (Priority: P2)

**Goal**: Managers and accountants see all company clients with their owner, and cannot add or edit.

**Independent Test**: As manager and as accountant, `/clients` lists both reps' clients with the owner. There are no add or edit actions, and a direct POST or PATCH with a valid body gets 403 (quickstart §2).

### Tests for User Story 5 ⚠️

- [ ] T072 [US5] Add to `tests/integration/features/clients/server/clients.service.test.ts`:
  - **"read-only roles"**: "manager lists all company clients with salesRep", "accountant lists all company clients", "manager and accountant read any company client".
  - **"role checks"**: "MANAGER cannot create/update", "ACCOUNTANT cannot create/update" (`FORBIDDEN`; the client is unchanged and no row is added).
- [ ] T073 [P] [US5] Add to `tests/integration/features/clients/server/clients.routes.test.ts`: "PATCH /api/clients/{id} with a valid body as ACCOUNTANT returns 403".

### Implementation for User Story 5

- [ ] T074 [US5] In `src/features/clients/client/clients-page/clients-page.tsx`, pass `showOwner={role !== "SALES"}` to `ClientsTable`.
- [ ] T075 [US5] In `src/features/clients/client/client-details/client-details.tsx`, show "المندوب: {salesRep.name}" when `role !== "SALES"`. Confirm the edit link stays hidden for MANAGER and ACCOUNTANT. T072 and T073 must pass (the service rules come from T062; fix T062 if they fail).

**Checkpoint**: The client permission matrix is complete.

---

## Phase 8: User Story 6 - Company isolation for units and clients (Priority: P1)

**Goal**: Prove that no user can read, edit or detect another company's units or clients. These are the spec's "Done when" tests.

**Independent Test**: Run the tests below. Each B-company read or edit returns 404 for every role and changes nothing.

### Tests for User Story 6 ⚠️

These tests prove behaviour built in US1–US5. They should pass once written; if any fails, fix the service, never the test.

- [ ] T076 [US6] Add to "tenant isolation" in `tests/integration/features/units/server/units.service.test.ts`:
  - "getUnit of company B → NOT_FOUND for MANAGER, SALES, ACCOUNTANT";
  - "updateUnit of company B → NOT_FOUND for every role, unchanged" (compare the full row before and after; no audit row in either company);
  - "list filters cannot reach company B" (a `status`/price range matching only B's unit returns `total: 0`).
- [ ] T077 [US6] Add to "tenant isolation" in `tests/integration/features/clients/server/clients.service.test.ts`:
  - "getClient of company B → NOT_FOUND for MANAGER, SALES, ACCOUNTANT";
  - "updateClient of company B → NOT_FOUND for every role, unchanged";
  - "client list excludes company B for MANAGER, SALES, ACCOUNTANT".
- [ ] T078 [P] [US6] Add to `tests/integration/features/units/server/units.routes.test.ts` and `tests/integration/features/clients/server/clients.routes.test.ts`:
  - "GET /api/{units|clients}/{company B id} returns 404";
  - "GET /api/{units|clients}/not-a-uuid returns 404";
  - "PATCH company B record with a valid body returns 404 for MANAGER (units) and SALES (clients)";
  - "GET /api/{units|clients}?companyId={company B id} returns only company A rows" (the unknown param is ignored; `total` equals the company A count).

**Checkpoint**: All "Done when" proofs exist and pass.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T079 [P] Update `README.md`:
  - **Assumptions**: add the phase 3 items from spec.md › Assumptions and the 5 clarifications (client roles, the price-only lock, no audit on create, alphabetical default order, field limits, loose phone, 404 for another rep's client).
  - **Technical decisions**: add the R1 conditional price update (and why no `FOR UPDATE`), R2 lazy expiry as one SQL UPDATE, R3 404-before-403 order, and R6 duplicate number as a field error, each with its rejected alternative.
- [ ] T080 [P] Self-review against AGENTS.md:
  - `grep -rn "companyId\|salesRepId\|status" src/features/*/*.schemas.ts` shows no input-schema field;
  - `grep -rn "\.omit(" src/` is empty;
  - `grep -rnE "\b(ml|mr|pl|pr|left|right)-" src/features src/shared/components` is empty;
  - no `console.` in `src/`;
  - every new server file starts with `import "server-only";`.

  Fix anything found.
- [ ] T081 Run `npm run lint && npm run typecheck && npm run test`, then `docker compose up -d db && npm run test:integration`. Everything must pass.
- [ ] T082 Run the manual checks in `specs/004-unit-client-management/quickstart.md` §2–§7 with `docker compose up` and the seed accounts. Record any failure as a new task and fix it.
- [ ] T083 Run `/security-review` on the branch and fix every open issue (constitution › Development Workflow). Then mark all tasks done in this file and commit `docs: mark phase 3 tasks done`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: T001 is a hard gate. Nothing starts until phase 2 is merged and this branch is rebased.
- **Phase 2 (Foundational)**: depends on Phase 1. It blocks every story.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)** and **US3 (Phase 5)**: after US1. They add to the same `units.repository.ts`, `units.service.ts`, `units.routes.ts` and test files, so they run in sequence: US1 → US2 → US3.
- **US4 (Phase 6)**: after Foundational only. Clients share no files with units, so it can run in parallel with US1–US3.
- **US5 (Phase 7)**: after US4 (same files).
- **US6 (Phase 8)**: after US3 (units part, T076) and US5 (clients part, T077). T078 needs both.
- **Polish (Phase 9)**: after everything.

### Within each story

1. Write the tests and see them fail.
2. Repository, then service (make the integration tests pass).
3. Routes and `src/app/api` re-exports (make the route tests pass).
4. Query options, then components, then `page.tsx`, then the nav link.
5. Commit after each task or small group.

### Shared files (never edit in parallel)

- `tests/integration/features/units/server/units.service.test.ts`: T026 → T040 → T049 → T076
- `tests/integration/features/units/server/units.routes.test.ts`: T027 → T041 → T050 → T078
- `tests/integration/features/clients/server/clients.service.test.ts`: T059 → T072 → T077
- `src/features/units/server/units.{repository,service,routes}.ts`: US1 → US2 → US3
- `src/features/units/client/units-page/units-page.tsx`: T037 → T048 → T056
- `src/features/units/client/unit-form/*`: T045/T046 → T054

## Parallel Examples

### Foundational

```text
Together: T004 DB checks test, T005 money test, T006 search-params test, T007 form-errors test, T008 conventions test
Then together: T010 error codes, T011 isUniqueViolation, T012 money, T013 search-params, T014 pagination, T017 UI primitives,
               T018 money-input, T019 pagination-nav, T020 state components, T021 session-users, T022 units schemas, T024 types/keys, T025 labels
```

### User Story 1

```text
After T030: T031 api re-exports, T032 query options, T033 status badge, T034 table, T035 filters (all different files)
```

### Units and clients side by side (after Foundational)

```text
Developer A: US1 → US2 → US3 (units)
Developer B: US4 → US5 (clients)
Both: US6, then Polish
```

## Implementation Strategy

### MVP first

1. Phase 1 gate, then Phase 2.
2. US1 (browse units with correct status and isolation): stop and validate with quickstart §3.
3. US3's price lock is the next most valuable rule (spec "Done when"). Do US2 then US3 to complete units.

### Incremental delivery

1. Units: US1 → US2 → US3, each validated at its checkpoint.
2. Clients: US4 → US5.
3. US6 proves isolation across both.
4. Polish: README, full test run, quickstart, `/security-review`.

## Notes

- Total: 83 tasks. Every test name matches [plan.md › Requirement → proof map](./plan.md#requirement--proof-map).
- If phase 2's real interfaces differ from research R11, change only the call sites. The behaviour and tests in this file stay the same.
- Out of scope (do not build): unit or client delete, client search, a unit detail page beyond the edit form, a reservation UI, CSV export.
