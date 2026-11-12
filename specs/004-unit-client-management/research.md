# Research: Units and Clients

Each entry: **Decision**, **Rationale**, **Alternatives considered**. No open "NEEDS CLARIFICATION" items remain.

## R1. Price lock without `SELECT … FOR UPDATE`

**Decision**: The price edit runs in one transaction:

1. `releaseExpired(companyId, tx)`.
2. Read the unit scoped by `companyId` (`null` → `NOT_FOUND`), then check the role (`MANAGER`, else `FORBIDDEN`).
3. If the new price equals the stored price (compare `BigInt(input.price) === unit.price`, because the stored value is a `bigint` and `===` against a `number` is always false), update only the other fields, with no status condition (FR-011: an edit that keeps the price is never refused because of the status).
4. Otherwise run one conditional update: `WHERE id = $id AND company_id = $companyId AND status = 'AVAILABLE' AND price = $oldPrice`.
   - 1 row → write the `PRICE_CHANGED` audit row in the same transaction.
   - 0 rows → re-read the unit:
     - gone → `NOT_FOUND`
     - status is not `AVAILABLE` → `UNIT_PRICE_LOCKED` (409)
     - still available but the price moved → `UNIT_CHANGED` (409), because another manager changed it first

**Rationale**: Under Postgres READ COMMITTED, an `UPDATE` that waits on a row locked by a concurrent writer re-checks its `WHERE` clause against the newly committed row version before it applies (the "EvalPlanQual" re-check).

- If a reservation commits `status = 'RESERVED'` first, the price update matches 0 rows.
- If the price update commits first, the reservation sees the new price. That is correct: the unit was still available when the price changed.

`price = $oldPrice` also makes the `oldPrice` in the audit row exact: the audit row can never record a price that was not the one replaced. This keeps the agreed rule ("update the price only WHERE status = 'AVAILABLE'") and needs no raw SQL.

**Alternatives considered**:
- `SELECT … FOR UPDATE` then update. Correct, but it needs raw SQL and holds a lock for no extra safety.
- Read, then update without the status condition. Not safe: a reservation between the read and the update would be ignored.

## R2. `releaseExpired(companyId)` as one SQL statement

**Decision**: `units.repository.ts` runs one parameterized `$executeRaw` tagged-template statement:

```sql
UPDATE units u SET status = 'AVAILABLE'
WHERE u.company_id = $companyId AND u.status = 'RESERVED'
  AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now())
```

The service calls it:
- before listing units,
- before reading one unit,
- inside the edit transaction (R1).

Phase 4 will call it before reserving, through `units/server/index.ts`.

**Check during implementation**: `@prisma/adapter-pg` may bind `${companyId}` as `text`, which fails against the `uuid` column (`operator does not exist: uuid = text`). If it does, write `${companyId}::uuid`. The expiry tests in the proof map prove which form works.

**Rationale**:
- One statement means no window between finding and fixing a unit.
- The database clock (`now()`) is the only clock, so app-server time drift cannot matter.
- Only `RESERVED` rows are touched, so a `SOLD` unit can never go back (FR-006).
- The tagged template sends `$companyId` as a bind parameter. That is not string-built SQL (constitution VII).
- The units feature never imports reservations, which keeps the dependency direction.

**Alternatives considered**:
- Prisma `updateMany` with a `reservations: { none: … }` relation filter. It is less explicit about producing one statement, and it is harder to read in review.
- A cron job. Rejected by AGENTS §5 (lazy expiry).

## R3. Order of the 404 and 403 checks

**Decision**:
- **Reads and edits of one record**: first load the record scoped by `companyId`, and by `salesRepId` when the user is a sales rep reading or editing clients. Not found → `NOT_FOUND` (404). Only then check the role → `FORBIDDEN` (403).
- **Creates**: these have no id, so they check the role first.
- **Invalid ids**: a malformed id in the path (not a UUID) → 404, never 400, so the id format reveals nothing.

**Rationale**:
- The spec matrix and FR-022 say a record of another company is 404 for every role, including roles that could never edit it.
- The 403 cannot leak anything. Every role that can get it can already read the record: all roles read units, and managers and accountants read all clients.
- A sales rep never gets a 403 on another rep's client, because the scoped load returns 404 first.

**Alternatives considered**: Checking the role first. It is simpler, but it returns 403 for a company-B unit to an accountant, which breaks the spec as written.

### Full check order in a route

1. Path id is not a UUID → 404.
2. Body or query fails the schema → 400 (the route parses before it calls the service, per AGENTS §1).
3. Record not found in the session company, or not owned for a sales rep's clients → 404.
4. Role not allowed → 403.

As a result, a wrong-role request with an invalid body gets 400, not 403. This leaks nothing, because step 2 does not depend on any record. Tests for 403 and 404 send valid bodies.

## R4. One parser for query parameters

**Decision**: `src/shared/lib/search-params.ts` exports `toQueryInput(source)`. It accepts either `URLSearchParams` (API) or Next's resolved `searchParams` record (`page.tsx`). It returns a plain object:
- An empty string becomes `undefined`. Otherwise `z.coerce.number()` would turn `""` into `0`.
- A repeated key becomes a `string[]`. The schema expects a string, so the result is a 400.

The same feature schema (`unitListQuerySchema`, `clientListQuerySchema`) then parses it.

- Numeric params (`page`, `pageSize`, `minPrice`, `maxPrice`) must match `^\d+$` before they are converted to a number. Plain `z.coerce.number()` would accept `" "` (as 0), `"0x10"` and `"1e3"`, which breaks "every invalid value returns 400".

- `z.object` strips unknown keys, so unknown parameters are ignored, as the spec's edge cases require.
- In `page.tsx`, a failed parse skips the prefetch. It does not throw.
- The client component parses `useSearchParams()` the same way. On failure it renders the error state with a "reset filters" link to the bare path.

**Rationale**: One function means the API and the page cannot disagree about what is valid. Not throwing in the page avoids a 500 or the error boundary for a hand-edited URL.

**Alternatives considered**: Silently resetting to the defaults. Rejected in the spec's Assumptions, because it hides the bad link.

## R5. Money in the API and in forms

**Decision**:
- **API and URL**: every money field is integer halalas (`price`, `minPrice`, `maxPrice`).
- **UI**: shows and accepts riyals.
- **Conversion**: `src/shared/lib/money.ts` is the only place that converts:
  - `parseRiyals(text)` returns integer halalas, or `null` for empty, negative or non-numeric text, or more than 2 decimals. It uses string-split arithmetic, never `parseFloat` × 100.
  - `formatRiyals(halalas)` formats with `Intl.NumberFormat('ar-SA')`.
- **Forms**: `src/shared/components/money-input/` holds the typed riyal text in local state and writes halalas into the form value (`NaN` when invalid). Zod (`z.number().int().positive().max(100_000_000_000)`) then reports it next to the field.

**Rationale**:
- AGENTS §4 says money is integer halalas everywhere, and conversion happens only in `money.ts`.
- The form, the API and the URL all share one schema, as the plan notes require.
- 1,000,000,000 SAR is 10^11 halalas, which is below 2^53. So `number` is exact.

**Alternatives considered**: Riyal strings in the API. Rejected: they would need a second schema and break the "same schema" rule.

## R6. Duplicate project name + unit number

**Decision**:
- The database unique index `units_company_id_project_name_number_key` is the only check. There is no read-then-insert race.
- `src/server/db.ts` gets `isUniqueViolation(err, constraint)`. It reads the Prisma error code `P2002` and the constraint name, and it is the only file outside repositories that touches Prisma error shapes.
- The service wraps `withTransaction` in `try/catch`. A unique violation becomes `AppError("VALIDATION_ERROR", { number: [UNIT_NUMBER_TAKEN] })`, so the error appears next to the unit-number field (FR-009).
- The Arabic text lives with the unit field rules in `units.schemas.ts`.
- The exact Prisma 7 adapter error shape is pinned by the integration test (see the proof map in plan.md).

**Rationale**:
- It is a field-level validation result for the user.
- A 400 with `fieldErrors` maps directly to `setError` (AGENTS Section B).
- A 409 would show at the top of the form instead.
- The check runs after the transaction, because a failed statement aborts the transaction.

**Alternatives considered**: A pre-check with `findFirst`. It has a race, and it costs a second query.

## R7. UI primitives with no new dependency

**Decision**: Hand-write shadcn-style primitives in `src/shared/components/ui/`. None of them imports `radix-ui`:
- `button.tsx`: a `buttonVariants` cva. Links use `<Link className={buttonVariants()}>` instead of `asChild`.
- `input.tsx`, `textarea.tsx`, `label.tsx`: native `<label>`.
- `native-select.tsx`: a native `<select>`.
- `table.tsx`, `badge.tsx`, `skeleton.tsx`, `alert.tsx`.

If phase 2 already added `button`, `input` or `label`, they are reused.

**Rationale**:
- `components.json` uses the `radix-nova` style, so `shadcn add` would install `radix-ui`. AGENTS §9 says no new package without asking.
- Native `<select>` is also better on mobile.
- `cva`, `clsx` and `tailwind-merge` are already installed.

**Alternatives considered**: `shadcn add select` (Radix). It needs a new dependency.

## R8. Detail and edit pages return 404 without fetching the API

**Decision**:
- `page.tsx` runs `await queryClient.prefetchQuery({ queryKey: unitKeys.detail(id), queryFn: () => getUnit(user, id) })`.
- It then reads `queryClient.getQueryState(key)?.error`. If that error is an `AppError` with `NOT_FOUND`, it calls `notFound()`.
- Any other error is left for the client's error state.

**Rationale**:
- This keeps the agreed `prefetchQuery` pattern: same key, service called directly.
- It still gives a real 404 page for another company's record (FR-022) instead of an empty form.

**Alternatives considered**: `fetchQuery` in a `try` block. It works, but it departs from the agreed wording.

## R9. Unit and client checks in the database (schema change)

**Decision**: Add one migration, `units_clients_checks`, with three checks:
- `clients_name_check`: `name = btrim(name) AND name <> ''`
- `clients_phone_check`: `phone = btrim(phone) AND phone <> ''`
- `units_price_max_check`: `price <= 100000000000` (1,000,000,000 SAR in halalas)

It is created with `prisma migrate dev --create-only` (`DATABASE_URL` must be set) and the SQL is edited before applying. There is no change to `schema.prisma`.

**Rationale**:
- Constitution V: integrity rules live in the database too.
- Phase 1 added the same trim checks to `units.project_name` and `units.number`, but not to clients.
- The price cap makes `Number(price)` in the DTO mapper safe at the database level, not only through the input schema (10^11 < 2^53). Phase 5 also divides this price, so it must never exceed what a JS `number` holds exactly.
- Zod trims first and has the same cap, so valid input always passes. All seed phones, names and prices already pass.

**Alternatives considered**:
- No migration. This would leave the only text rule of this phase enforced only in code.
- A regex check on phone. Rejected: the phone format is a loose UI rule (spec Assumptions) and may change.

## R10. Notes shown as plain text

**Decision**:
- Notes render as a React text child inside `<p className="whitespace-pre-wrap">`, so line breaks are kept.
- React escapes text children.
- A new case in `tests/unit/architecture/conventions.test.ts` fails if `dangerouslySetInnerHTML` appears anywhere in `src/`.
- Integration tests prove that notes containing `<script>` are stored and returned exactly as typed.

**Rationale**:
- This is FR-019 and constitution VII ("user text is rendered as text").
- There is no React DOM test library to add (no new dependency). A repo-wide ban is a stronger and cheaper proof.

**Alternatives considered**: Sanitizing on input. It changes user data, and it is not needed when output is escaped.

## R11. Dependency on phase 2 (authentication)

**Decision**: This phase uses phase 2's modules and does not create them. Implementation starts only after phase 2 is merged (constitution, Development Workflow). It needs:

| Needed from phase 2 | Expected shape |
|---|---|
| `requireUser()` in `src/server/auth/` | `Promise<SessionUser>` where `SessionUser = { userId: string; companyId: string; role: "MANAGER" \| "SALES" \| "ACCOUNTANT" }`; redirects pages to login |
| `handleRoute({ auth: "user", handler })` | the handler receives the session user, for example `(req, ctx, user)` |
| Audit writer | a function that takes `tx` and `{ companyId, userId, action, entityId, meta }` and inserts one `audit_logs` row through a repository |
| App shell | an authenticated layout and navigation where the "الوحدات" and "العملاء" links are added |
| Login test helper | a way for route-level tests to send a valid session cookie |

If phase 2 lands with different names, `/speckit-tasks` adapts the calls. The behaviour in this plan does not change.

**Rationale**:
- If two phases each create `src/server/auth` or an audit module, they conflict when merged.
- The main proofs do not depend on login: service-level integration tests build `SessionUser` from `tests/integration/support/db-fixtures.ts`.

**Alternatives considered**: Stubbing auth in this phase. That is throw-away code, and it risks a security gap if it is ever merged.

## R12. Default ordering and stable pages

**Decision**:
- **Units, no sort chosen**: `ORDER BY project_name ASC, number ASC, id ASC`.
- **Units, sort chosen**: `ORDER BY <price|area> <asc|desc>, id ASC`.
- **Clients**: `ORDER BY name ASC, id ASC`.
- **Skip and size**: `skip = (page - 1) * pageSize`.
- `order` without `sort` is ignored.
- A page past the end returns `items: []` with the true `total`.

**Rationale**: This is the clarified default sort (spec, 2026-11-12). `id` is the agreed second key, so equal values never repeat or skip a row across pages.

**Alternatives considered**: Keyset pagination. It is not the agreed approach, because the plan notes fix offset pagination.
