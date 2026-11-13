# Aqar Lite

A multi-tenant system to sell real-estate units by installments (Next.js, PostgreSQL, Prisma).
Many companies share one system, and no company can see another's data. Staff log in by role (manager, sales
rep, accountant): the manager adds units, changes prices and reads the audit log; a sales rep adds clients,
reserves a unit for 72 hours and drafts a contract with a schedule preview; the accountant approves the
contract (the unit becomes sold and the monthly schedule is fixed) and records payments, which fill the oldest
installments first. The UI is Arabic, right-to-left, and works on mobile and desktop.

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

The database uses host port **5433** so it does not clash with a Postgres already running on 5432. Port 3000
(app) is fixed; the database port can be changed with `DB_HOST_PORT=5434 docker compose up`. Both must be free.
The first build takes several minutes (base images and `npm ci`); later builds use the cache. Stopping and
starting again keeps the data; the seed never adds duplicates.

If you used an older volume from before the test database existed, reset it once: `docker compose down -v`.

The full flow by hand, with the accounts below:

1. `manager@ufuq.test`: **الوحدات** → edit an available unit and change its price.
2. `sales1@ufuq.test`: **الوحدات** → reserve an available unit for one of your clients; **الحجوزات** →
   create the contract (final price, down payment, number of installments) and check the schedule preview.
3. `accountant@ufuq.test`: **العقود** → open the draft → approve; then record a payment on the contract page.
4. `manager@ufuq.test`: **سجل التدقيق** → the price change, the approval and the payment are listed, newest first.
   A failed login on any Ufuq account is listed too.
5. `manager@nukhba.test`: none of Ufuq's units, clients, contracts or audit events are visible.

Demo accounts. Log in at http://localhost:3000/login. Password for every account: `AqarLite#2026`
(demo only; stored only as an Argon2id hash).

| Company                    | Role       | Name           | Email                    |
| -------------------------- | ---------- | -------------- | ------------------------ |
| شركة الأفق للتطوير العقاري | Manager    | مدير الأفق     | `manager@ufuq.test`      |
| شركة الأفق للتطوير العقاري | Accountant | محاسب الأفق    | `accountant@ufuq.test`   |
| شركة الأفق للتطوير العقاري | Sales rep  | مندوب الأفق 1  | `sales1@ufuq.test`       |
| شركة الأفق للتطوير العقاري | Sales rep  | مندوب الأفق 2  | `sales2@ufuq.test`       |
| شركة النخبة العقارية       | Manager    | مدير النخبة    | `manager@nukhba.test`    |
| شركة النخبة العقارية       | Accountant | محاسب النخبة   | `accountant@nukhba.test` |
| شركة النخبة العقارية       | Sales rep  | مندوب النخبة 1 | `sales1@nukhba.test`     |
| شركة النخبة العقارية       | Sales rep  | مندوب النخبة 2 | `sales2@nukhba.test`     |

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

Each decision says what was chosen, why, and what was rejected.

Core choices (all phases):

- **Layers: route → service → repository, by feature.** Route handlers only check the session, parse input
  with Zod and call a service; services hold every business rule, role and ownership check and transaction;
  repositories hold the Prisma queries. Pure money and date logic lives in `features/<f>/domain/`. Features
  depend one way: payments → contracts → reservations → units, clients. Rejected: business logic in route
  handlers or React components (the brief asks for a separate layer and it cannot be unit-tested there).
- **Route Handlers + TanStack Query, no Server Actions.** Pages call `requireUser()`, prefetch with the same
  query key and the service, and hydrate; the browser reads and writes through `/api`. Every endpoint is a
  plain HTTP route with the same auth wrapper and the same tests. Rejected: Server Actions (a second kind of
  endpoint to secure and test), a separate API server (more to run for no gain at this size).
- **Money is integer halalas.** `BIGINT` in PostgreSQL, `number` in code and JSON (the cap of 1,000,000,000
  riyals is far below 2^53), and riyals ⇄ halalas only in `src/shared/lib/money.ts`. Rejected: `float`
  (rounding errors) and `Decimal` (needs a decimal library in code and strings in JSON).
- **Derived state is computed, never stored.** Installment status, the remaining amount and "reservation is
  active" are computed from stored facts on read. Rejected: status columns (they drift from the facts).
- **Hand-written auth with database sessions.** 32-byte random token in an `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie; only its SHA-256 hash is stored; logout deletes the row. Passwords use Argon2id
  (`@node-rs/argon2`). Rejected: JWT (cannot be revoked at logout without a deny list), Auth.js or Better Auth
  (more surface than login and logout need), bcrypt (Argon2id is the current recommendation).
- **Integrity rules also live in the database.** Checks, unique keys, composite foreign keys (a row can only
  point to rows of its own company) and triggers (payments and audit rows are append-only; approved contracts
  are frozen). Rejected: code-only checks (one bug or one manual SQL statement would break them).
- **Integration tests use the real Postgres.** A second database, `aqar_test`, in the same container.
  Rejected: mocks (they cannot prove locks, triggers or races) and Testcontainers (the Compose database is enough).

Phase 0–2:

- **Production build in Docker.** The image builds the app and runs `next start`, so reviewers see what would
  ship. Developers use `npm run dev` for hot reload. Rejected: `next dev` in the container (not what ships,
  slower, different error pages).
- **Version pins.** TypeScript 6.0 (not 7: `typescript-eslint` supports `<6.1`), ESLint 9 (not 10: plugins used
  by `eslint-config-next` support up to 9), Prisma 7.10.1 pinned exactly (npm's `latest` tag for the Prisma CLI
  points to an 8.0 release candidate). Rejected: floating `latest` versions (a fresh `npm ci` could break lint).
- **Prisma 7 with `@prisma/adapter-pg`.** Prisma 7 has no built-in query engine and needs a driver adapter.
  Rejected: Drizzle (both are allowed by the brief; Prisma's migrations and typed client were the faster path).
- **Settings are checked at startup, never at build time.** `getEnv()` is lazy, so building the image needs no
  secrets. The container entrypoint and `src/instrumentation.ts` both refuse to start with a bad setting and list
  every bad variable without printing values. Rejected: checking at build time (the image would need secrets).
- **Layer rules are enforced by tooling.** ESLint blocks ORM imports outside `*.repository.ts` and
  `src/server/db.ts`, and server imports in client and shared code. Every server file starts with
  `import "server-only"`, so `next build` also fails if client code imports it. Tests prove both. Rejected:
  rules written only in a document (nothing stops a break).
- **The Arabic font is committed.** IBM Plex Sans Arabic (400, 500, 700; woff2; SIL OFL 1.1 in
  `src/shared/fonts/ofl.txt`) loads with `next/font/local`, so the build works with no network and the page
  needs no external font or style source (`font-src 'self'`). Rejected: `next/font/google` (network at build time).
- **Login is serialized per email.** `login()` takes a Postgres advisory lock on the email inside its
  transaction, so parallel attempts cannot all read "4 failures" and all guess. The lock count reads the
  existing `meta->>'email'` audit index. Rejected: a separate counter table (a second source of truth next to
  the audit rows).
- **`GET /api/auth/me`** returns the current user's name, role and company, or 401. Tests use it to prove a
  session works or is dead; the pages read the user on the server with `requireUser()`. Rejected: auth checks
  in middleware (it runs before the route and cannot replace the per-request check in each handler).
- **Rejected:** `output: "standalone"` (it leaves out the Prisma CLI needed for `migrate deploy`), a separate
  migration service (more moving parts), Testcontainers (the Compose database is enough).

- **Conditional price updates (phase 3).** Unit edits run in one transaction. A changed price is updated
  only where the unit is still `AVAILABLE` and its price equals the value read. PostgreSQL rechecks the
  predicate after a concurrent writer commits: a reservation wins with `UNIT_PRICE_LOCKED`; a competing
  price change yields `UNIT_CHANGED`. The audit entry records the exact replaced price in the same
  transaction. Rejected: `SELECT … FOR UPDATE` (extra raw SQL/lock duration without extra safety here),
  and an unconditional update after a read (races with reservations).
- **Lazy reservation expiry.** Before unit reads, edits, reservations and the reservations list,
  `releaseExpired()` frees only the company's `RESERVED` units with no unexpired reservation, using the
  database clock. `SOLD` units stay sold. Since phase 4 it runs two statements in one transaction:
  `SELECT … ORDER BY id FOR UPDATE` on the candidate units, then an `UPDATE` of those ids that re-checks
  the same condition. A single `UPDATE … NOT EXISTS` was proven unsafe under READ COMMITTED: when it waits
  on a unit row that a reserve is holding, it re-checks only that row and keeps its old snapshot for the
  subquery, so it freed a unit that had just been reserved. A test reproduces this race and fails on the
  old statement. Rejected: cron (not the agreed model).
- **404 before 403.** Single-record services load by session company first; SALES client reads/edits
  also scope by session owner. Missing records return 404 before checking edit roles. Creates check
  roles first; malformed path ids return 404 before body parsing. Rejected: role-first record checks,
  which violate uniform cross-company 404 responses. Routes still validate bodies before services.
- **Duplicate unit numbers are field errors.** The database unique constraint on company/project/number
  decides conflicts. After a failed transaction, the service maps the violation to a 400 with
  `fieldErrors.number`. Rejected: read-before-write duplicate checks (racy), and a top-level 409
  (does not put the message next to the field).

- **Reserving is one conditional update (phase 4).** One transaction runs the expiry release, then
  `UPDATE units SET status = 'RESERVED' WHERE id = … AND company_id = … AND status = 'AVAILABLE'`, then
  inserts the reservation. Postgres lets exactly one of two parallel requests change the row; the other
  updates 0 rows. After 0 rows the unit is re-read: missing (or another company's) → 404, otherwise 409
  `UNIT_NOT_AVAILABLE`. Tests run two reps in parallel ten times in a row, through the service and through
  the HTTP handlers. Lock order is always release first, then the unit row. Inside a transaction a service
  calls only repository functions that take `tx`, never another service, so no transaction nests. Rejected:
  read the status, then update (two reps both read `AVAILABLE`), and a unit lock held across the request.
- **One clock.** The expiry is written as `now() + 72 hours` in SQL, and "active" is read against the
  database `now()`. The list returns that `asOf` time, so "time left" never uses the browser clock.
  Rejected: the app server clock or the browser clock (they can differ from the database and from each other).
- **The reserve dialog is a page-level slot.** `units/page.tsx` passes `<ReserveUnitDialog />` into
  `<UnitsPage reserveDialog={…} />`. The units feature never imports the reservations feature. The dialog
  opens from `?reserve=<unitId>` and closes by removing it, so a reload reopens it on the same unit.
  Rejected: importing the reservations dialog inside the units feature (a cross-feature client import).

- **One schedule function (phase 5).** `features/contracts/domain/schedule.ts › buildSchedule` is pure and
  works on integer halalas and `YYYY-MM-DD` strings. The down payment is line 0, due on the start date, and
  is left out when it is 0. The rest is split into whole riyals; the last line takes the remainder, halalas
  included, so the lines always add up to the final price exactly. Line `i` is due `addMonths(start, i)`
  in Asia/Riyadh, always counted from the start, never from the previous line: a 31 January start gives
  28/29 February, 31 March, 30 April. The form preview, the draft page and approval all call this one
  function, so the preview cannot drift from the stored schedule. Rejected: dividing in decimal riyals
  (loses halalas), and counting from the previous due date (31 Jan → 28 Feb → 28 Mar is wrong).
- **Approval locks the contract, then the unit, then reads the clock (phase 5).** The agreed order was:
  lock the contract row, check the reservation is active, compare the values, set `approvedAt`, change the
  unit `RESERVED → SOLD` with a conditional update, insert the installments, write the audit row, all in
  one transaction. That alone has a race: an approval that starts just before the reservation expires
  checks expiry against its own start time; meanwhile a units-list read frees the unit and another rep
  reserves it; the approval's `WHERE status = 'RESERVED'` still matches and sells the unit under the other
  rep's reservation. The fix: right after the contract lock, approval also takes `SELECT … FOR UPDATE` on
  the unit row, then reads `clock_timestamp()` and requires the reservation to expire after that moment.
  While approval holds the unit lock and its reservation is still active, no release or new reservation
  can have touched that unit. The conditional `RESERVED → SOLD` update stays as a second guard. Lock order
  is always contract, then unit; no other path locks a unit and then a contract, and approval never calls
  `releaseExpired`, so there is no deadlock. `approvedAt`, the start date and the audit time all come from
  that one clock read. Rejected: SERIALIZABLE with retries (a retry loop for one path), and an `EXISTS …
  clock_timestamp()` inside the unit update (relies on subtle re-check behaviour).
- **Approval is all or nothing, and proven so.** A test adds a temporary database trigger that makes the
  approval's audit insert (its last write) fail, then checks the contract is still a draft, the unit is
  still reserved, and no installments or audit row exist. No mocks: it is a real database failure.
  Rejected: a mocked repository that throws (it would not prove the database rolled back).
- **Calendar dates stay strings.** Due dates are `YYYY-MM-DD` in the domain and are stored as UTC midnight of
  that day in a `date` column. A `Date` built at Riyadh midnight is 21:00 UTC the day before, which Prisma
  would store as the previous day. "Today" is the Riyadh date of the database clock, sent to the browser,
  so the preview and the statuses never depend on the device's clock or time zone. Rejected: `Date` objects for
  calendar days (they shift by a day across time zones).
- **Approved contracts are frozen in the database.** A trigger refuses any `UPDATE` or `DELETE` of a contract
  row whose `approved_at` is set, and another lets an installment change only its `paid_amount` (for
  payments) and never be deleted. A check caps the final price at 1,000,000,000 riyals, like the unit price.
  The service also edits drafts with `UPDATE … WHERE approved_at IS NULL`, so an edit that races an approval
  gets 409. Rejected: relying on the service check alone (a direct SQL update would still change money terms).
- **Payments run one at a time per contract.** Recording a payment locks the contract row (`FOR UPDATE`)
  first, then checks the `Idempotency-Key`, then the amount, then stores the payment, adds the paid amounts
  and writes the audit row, all in one transaction. Under READ COMMITTED each statement after the lock sees
  what the previous payment committed, so two accountants can never pay past the remaining amount and two
  copies of one request create one payment. Parallel tests prove both. The key check comes before the amount
  check, so retrying a final payment returns it instead of a false "too much" error. Rejected: SERIALIZABLE
  with retries (a retry loop), and the unique key index alone (stops duplicates, not overpayment).
- **Allocation is a pure function** (`features/payments/domain/allocation.ts`): lowest line number first,
  skips full lines, and the applied amounts always add up to the payment. A new payment returns 201; a replay
  returns 200 with the same body. Rejected: allocating inside SQL (harder to unit-test edge cases such as a
  payment that spans several lines).
- **The audit log is its own read-only feature (phase 7).** `features/audit-log/` reads `audit_logs` with a
  repository that requires the session company, so rows of another company and failed logins with an unknown
  email (no company) never match. Only `MANAGER` passes the service check. The API has only `GET`. Rejected:
  adding the paged read to the shared `src/server/audit/` write helper (it would mix a screen's query into
  infrastructure that four features use).
- **Audit details are parsed per event type on the server.** Each of the four event types has a Zod schema for
  the details its writer stores. The API sends a typed object, or `null` if the stored details do not match;
  the browser never receives the raw JSON. For a failed login only the typed email and the reason are sent,
  not the name of the targeted account. A test creates each event through its real writer (login, price
  change, approval, payment) and checks every row reads back, so a writer that changes its details fails it.
  Rejected: sending the raw JSON and formatting it in the component (unchecked data in the browser, logic
  in React).
- **No `npm audit fix`.** `npm audit` shows 0 high and 0 critical findings; the 7 moderate ones are in the
  `@typescript-eslint/*` lint tooling (dev only, not in the image). Rejected: `npm audit fix --force` (it would
  move the TypeScript and typescript-eslint pins above for findings the brief does not require fixing).

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

### Phase 3: units and clients

- Phases 1–2 supply the database schema, seed, login, sessions and roles; phase 3 builds on them.
- Unit and client lists default to alphabetical ascending order: units by project name then number,
  clients by name, with id as the final tie-breaker. Pagination defaults to 20, with a maximum of 50.
- Only the unit **price** is locked for reserved or sold units. Managers may edit project name, number,
  type, area and rooms in every status. Saving the same price is not a price change and writes no audit.
- Creating a unit writes no price-change audit; only changing an existing price does.
- Managers and accountants read all company clients, including their owning rep, but cannot add or edit
  them. Only SALES creates clients and edits its own; the owner comes from the session and never changes.
- Another rep's client returns 404, not 403, even on edits. Other-company units and clients also return
  404 for every role. Company/owner fields sent by the caller are ignored.
- Phone validation is deliberately loose: 7–20 characters, digits with optional leading `+`, spaces
  and dashes, with no country-specific validation. Duplicate phone numbers are accepted across reps.
- Project and client names are limited to 100 characters; unit number to 20; notes to 2,000; rooms to
  0–50; whole-square-meter area to 1–100,000; price to above zero and at most 1,000,000,000 riyals.
- Price inputs and filters display riyals with up to two decimals; API/URL/database values are integer
  halalas. Notes are plain text, preserve line breaks, and are never interpreted as HTML.
- Clients have pagination but no search or filtering. Neither units nor clients has delete functionality.
- Reservation UI comes in phase 4; phase 3 tests create reservations directly in the test database.
- Invalid list URL parameters show an error with a reset action instead of silently replacing the URL.

### Phase 4: reservations

- A reservation lasts exactly 72 hours from the database time when it is created. There is no manual
  cancel and no extension. A rep may hold any number of reservations, for one or many clients (agreed in
  clarify); this allows hoarding units, which a cap per rep would fix later.
- Only SALES reserves, and only for its own clients. Another rep's client, or another company's unit or
  client, returns 404. A unit that is not `AVAILABLE` returns 409 with an Arabic message.
- Reserving starts only from the units list. The client picker shows the rep's first 50 clients by name.
- A reservation is "active" while its expiry is strictly in the future and it has no approved contract.
  An expired reservation row is kept as history; only the unit becomes available again.
- The units list shows "reserved until" for a reserved unit, never the client or the rep.
- `/reservations` lists active reservations, soonest expiry first: a rep sees only their own, the manager
  sees the whole company with a rep column, and the accountant has no reservations view (the page redirects home, the API
  returns 403, and there is no nav item).

### Phase 5: contracts and installment schedule

- A sales rep creates one contract per reservation, only from their own active reservation, and edits it
  only while it is a draft and the reservation is still active. Only an accountant approves. Managers and
  accountants see every contract of the company; a rep sees only their own. There is no delete or cancel.
- Monthly installments: 1 to 120. The brief sets only a minimum of 1; 120 is a safety bound against huge
  inputs (for example a request with a million installments) and is one constant in code.
- The final price is at least 95% of the unit price, rounded up to the halala. It may be above the unit
  price, up to 1,000,000,000 riyals: the brief only sets a floor. The control is that only an accountant
  approves, after the value check, and the approval audit row records both the unit price and the final
  price.
- Every installment is at least 1 riyal. Installments are whole riyals; the last one takes the remainder.
  The down payment may have halalas and is less than the final price.
- Before approval the schedule is a preview with dates as if approved today, labelled
  "التواريخ تقديرية، وتُثبَّت عند الاعتماد". On approval the start date is the approval date in Saudi time.
- Installment status is computed when shown: paid, then overdue (due date before today in Saudi time, even
  if partly paid), then partial, then unpaid. A line due today is not overdue.
- A draft whose reservation expired stays as history, marked "انتهى الحجز", and cannot be edited or
  approved. The unit is freed by the phase 4 rule and can be reserved again with a new contract.
- Approval refuses (409) when the reservation expired, when the contract was already approved, or when the
  final price, down payment or installment count differ from what the accountant saw.
- The contracts list has no filter: drafts first, then approved contracts by newest approval.

### Phase 6: payments

- Only an accountant records a payment, only on an approved contract, for any amount from 0.01 riyal up to
  the remaining amount. Halalas are allowed because the down payment and the last installment may have them.
- The payment date is always the moment the server records it; there is no field for a past or future date.
  A payment has only an amount: no method, reference or note.
- "Oldest" means the lowest line number (the down payment first). Being overdue does not change the order.
- Same `Idempotency-Key`, same contract, same amount: the original payment comes back. Same key with a
  different amount: 409 with the amount already saved (decided with the reviewer; the plan note first said
  to return the original). The form keeps its key across retries and double clicks and makes a new one only
  after a success or after that 409. Keys are per contract.
- A sales rep does not see the payments list, even on their own contract (`GET` returns 403); they see paid
  amounts and statuses on the schedule only. Accountants and managers see the list.
- Who recorded each payment and how it was split across installments are kept in the `PAYMENT_RECORDED`
  audit row (amount, `[{ seq, applied }]`, remaining after), not shown on the contract page.

### Phase 7: audit log and delivery

- Only a manager reads the audit log: newest first, 20 per page (at most 50), with no filters (agreed in
  clarify; a filter is in "Not done"). Accountants and sales reps have no nav item, the page sends them home,
  and the API returns 403.
- The log shows only the manager's company. A failed login with an email that matches no account belongs to no
  company, so no one sees it in the app; it stays in the database for the login lock.
- A failed login against a real account is shown with the email that was typed, not the account holder's
  name: the stored account is only the target, not proof that this employee typed the wrong password.
- Each row shows the event type as a colored badge, the time in Saudi time, the user, and the details in
  Arabic: old and new price; the approved terms; the payment amount, how it was split (installment 0 is the
  down payment) and the remaining amount; the reason for a failed login. Price changes link to the unit,
  approvals and payments to the contract. Those pages run their own role and company checks.
- The brief's "Extra" items (a Playwright test and tests in CI) were not built: time went to the required
  items. They are in "Not done" with how they would be built.

## Security

### The 3 biggest risks

We assume the attacker is a logged-in user of one of the companies.

1. **Cross-company data leak (IDOR).** An attacker changes an id in a URL or a request body to read or change
   another company's unit, client, contract, payment or audit event. Handled: the company comes only from the
   server session; every repository function requires `companyId` and filters by it; another company's record
   answers 404 (the same as a missing one, so ids cannot be probed); composite foreign keys stop a row from
   pointing at another company's row even with a bug in the code. Details in "How company isolation is
   guaranteed" below. Proven by the "company B" cases in every
   `tests/integration/features/*/server/*.service.test.ts` and `*.routes.test.ts` (for example
   `units.routes.test.ts` › "GET /api/units?companyId=<company B id> still lists only company A units") and by
   `tests/integration/prisma/schema-constraints.test.ts` › "rejects a client whose sales rep belongs to another
   company".
2. **Privilege escalation and mass assignment.** A sales rep calls the API directly to change a price, approve
   a contract or record a payment, or sends fields such as `companyId`, `salesRepId`, `status`, `approvedAt`
   or a schedule in the body. Handled: every service checks the role and the owner before it acts (hiding a
   button is never the check); input schemas are allowlists built with `.pick()`, and only the parsed input
   reaches Prisma, so extra fields are dropped; owner, company, status and dates come from the session and
   the database. Proven by `units.routes.test.ts` › "PATCH with a valid body as SALES returns 403" and
   "POST as MANAGER returns 201 and strips status and companyId", `reservations.service.test.ts` › "ignores
   hand-sent expiresAt, salesRepId, companyId, status", `payments.service.test.ts` › "MANAGER and SALES cannot
   record (FORBIDDEN), nothing saved", and the 403 cases in `audit-log.routes.test.ts`.
3. **Duplicated money operations.** Two reps reserve one unit at the same moment; a double click or a network
   retry records a payment twice; two accountants together pay more than the remaining amount. Handled: a
   reservation is one conditional `UPDATE … WHERE status = 'AVAILABLE'`, so only one request can win; a
   payment needs an `Idempotency-Key` (unique per contract) and runs in one transaction that locks the
   contract row first, so the second copy returns the first payment and the second accountant sees the new
   remaining amount; payments are append-only (database trigger). Proven by `reservations.routes.test.ts` ›
   "two parallel POSTs from two rep sessions: one 201, one 409", and `payments.service.test.ts` › "parallel
   requests with the same key → exactly one payment (×5)" and "two parallel payments above the remaining
   amount → exactly one succeeds (×5)".

Dependency audit: `npm audit` reports 0 critical and 0 high findings. The 7 moderate findings are in the
`@typescript-eslint/*` lint tooling, which is a dev dependency and not in the image (see Technical decisions).

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

Phase 4 controls: a double reservation is impossible because the unit status changes with one
conditional `UPDATE`, and the expiry release locks rows first (see Technical decisions). The owner, company,
status and expiry of a reservation come from the session and the database, never from the request body.

Phase 5 controls: every contracts query filters by the session company, and for a sales rep also by the
reservation's rep, so another company's or another rep's contract is 404. The approval race above is
closed with a unit lock and the current database clock. Approved contracts and their schedules cannot be
changed even with direct SQL (triggers). The request body never sets the company, rep, status, approval
date or schedule; only the three terms (and the reservation on create) are read.

Phase 6 controls: the amount is the only field read from the body; the contract comes from the path and
the key from the header. Every payments query reaches the company through the contract, so another
company's contract is 404 even with a known key. Payments and audit rows cannot be changed or deleted
(phase 1 triggers), and the payments API has no update or delete method (a test checks the route exports).

Phase 7 controls: only managers read the audit log (service check, 403 for others); the query reads only the
session company, so failed logins with an unknown email are never shown; stored details are parsed per event
type and the raw JSON never reaches the browser; the typed email of a failed login is chosen by an outsider, so
it is rendered as plain text (React text, no `dangerouslySetInnerHTML`, enforced by a test) and shortened on
screen; the audit API has only `GET`, and the database refuses any update or delete of an audit row.

## How company isolation is guaranteed

1. **The company comes only from the session.** `requireUser()` (pages) and `handleRoute({ auth: "user" })`
   (API) load the session by the hash of the cookie token and return `{ userId, companyId, role }` from the
   user row. No input schema has a `companyId` field, so a value sent in a body or query string is dropped.
2. **Every data access takes the company.** Every repository function has a required `companyId` argument and
   puts it in the `WHERE` clause (payments and installments reach it through their contract). Only
   repositories import Prisma, and ESLint fails the build if any other file does, so no query can skip this.
3. **The database checks it too.** Tables carry `company_id`, and composite foreign keys such as
   `(company_id, client_id)` on reservations mean a reservation, contract or client cannot point at another company's row,
   even if the code had a bug.
4. **Another company's record answers 404.** Services load a record by id and session company together, so
   "exists in another company" and "does not exist" give the same answer and ids cannot be probed.
5. **Three lookups run before the company is known** (constitution I): the user by login email, the session
   by token hash, and the count of recent failed logins by email. They cannot take a company because they are
   how the company is found. Each returns only the caller's own user or session, or a number, and everything
   after them takes `companyId` from the session.
6. **Tests prove it for every feature**, each with two companies made by `makeTwoCompanies()`:
   `tests/integration/features/units/server/units.service.test.ts` and `units.routes.test.ts`,
   `tests/integration/features/clients/server/clients.repository.test.ts` and `clients.routes.test.ts`,
   `tests/integration/features/reservations/server/reservations.service.test.ts` and `reservations.routes.test.ts`,
   `tests/integration/features/contracts/server/contracts.repository.test.ts` and `contracts.service.test.ts`,
   `tests/integration/features/payments/server/payments.service.test.ts` and `payments.routes.test.ts`,
   `tests/integration/features/audit-log/server/audit-log.service.test.ts`, and
   `tests/integration/prisma/schema-constraints.test.ts` for the database rules.

## Not done

Every required item of the brief is built. These were left out, each with how it would be built:

- Audit log filters: no event-type or date-range filter (agreed in clarify). Built as two more validated query
  fields (`action` from the four types, `from`/`to` as Riyadh days turned into instants) and a `WHERE` on the
  existing `(company_id, created_at)` index, kept in the URL like the units filters.
- Playwright E2E (brief "Extra"): one spec against the `docker compose` stack that logs in as `sales1`,
  reserves an available unit, drafts the contract, logs in as `accountant`, approves and records a payment,
  then checks the contract shows it. It would pick any available unit so it can run twice on the same data.
  Needs `@playwright/test` as a new dev dependency.
- Tests in CI (brief "Extra"): `.github/workflows/ci.yml` runs lint and typecheck on pull requests. With more
  time it would add a `postgres:18` service, `prisma generate`, `npm run test` and
  `TEST_DATABASE_URL=… npm run test:integration`.

- Payments: no refund or correction (a payment cannot change; a correction would be a new, audited
  adjustment record), and the payments list on a contract is not paged (it is entered by hand, so it stays
  short).

- Contracts: no delete or cancel (out of scope), no status filter on the list, and no database check that
  the installments add up to the final price (one writer, approval, builds them with a tested function; a
  deferred constraint trigger could add it).

- Reservations: no manual cancel, no cap per rep or per client, and no search in the client picker (it shows the
  first 50 clients by name).
- A second database guard against overlapping reservations: an exclusion constraint (`btree_gist`, a
  `reserved_at` + `expires_at` range per unit). The conditional `UPDATE` on the unit status already lets only
  one reservation win, and the parallel test proves it, so time went to contracts and payments instead.

- The app connects as the table owner, which could deliberately disable the append-only triggers.
  The fix is a separate migration owner role and a low-privilege app role, with `UPDATE`, `DELETE` and
  `TRUNCATE` revoked on `payments` and `audit_logs`, and two database URLs (migrations and app).
- No per-IP login limit and no CAPTCHA. With more time: a per-IP limit when deployed behind a trusted proxy, with
  the client IP taken only from that proxy's header, or a CAPTCHA after repeated failures. It is not built now
  because `docker compose up` has no proxy: requests reach the app through Docker's network, so the app sees
  the Docker gateway address instead of each user's address. A per-IP limit would then either block everyone at
  once or have to trust a forwarding header that any client can fake.

## AI tools

AI tools were used in every phase, with SpecKit as the workflow (`specs/001-…` to `specs/008-…`):

- **Specs, clarifications, plans and tasks:** written with Claude Code from the brief. Open business rules
  (for example 120 installments at most, the 31 January rule, no audit filters) were asked in the clarify
  step, decided by the developer, and recorded in the spec and in "Assumptions" above.
- **Code:** written by Claude Code and by Codex (through the pi CLI) from the task lists, part by part.
- **Review:** each part's diff was read against `AGENTS.md` and the constitution, and the full lint,
  typecheck, unit and integration suites were run before each commit. `/security-review` (Claude Code) was
  run on the phase 7 changes.
