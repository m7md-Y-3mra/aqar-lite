# Aqar Lite — SpecKit Phases

Eight phases, in order. Each phase is one SpecKit feature (one branch, one spec folder).
Total time ≈ 15.5 hours, inside the 12–16 hours in the brief.

| # | Phase | Depends on | Time |
|---|---|---|---|
| 0 | Project Setup and Tooling | — | 1 h |
| 1 | Database Schema and Seed | 0 | 1.5 h |
| 2 | Authentication and App Shell | 1 | 2 h |
| 3 | Units and Clients | 2 | 2 h |
| 4 | Reservations | 3 | 1.5 h |
| 5 | Contracts and Installment Schedule | 4 | 3 h |
| 6 | Payments | 5 | 2.5 h |
| 7 | Audit Log, Hardening and Delivery | 6 | 2 h |

## Before Phase 0 (by hand, 10 minutes)

1. Create an empty folder, run `git init`.
2. Run `specify init . --ai claude`.
3. Copy in: `AGENTS.md`, `CLAUDE.md`, `docs/brief.md`, `docs/brief.ar.md`, `docs/phases.md`, and `constitution.md` → `.specify/memory/constitution.md` (copy it AFTER `specify init`, so the template does not replace it).
4. Commit: `chore: add project rules, brief and constitution`.

Note: `/speckit.plan` may add a "technologies" block to `CLAUDE.md`. After each plan, delete that block so `CLAUDE.md` stays only `@AGENTS.md`.

## Steps for every phase

1. `/speckit.specify` — paste the phase's specify text.
2. `/speckit.clarify` — answer the questions. Check the phase's "Clarify focus" list.
3. `/speckit.plan` — paste the base plan prompt, then the phase's "Plan notes" under it.
4. `/speckit.tasks`
5. `/speckit.analyze` — fix every conflict before you build.
6. `/speckit.implement`
7. Run `npm run lint && npm run typecheck && npm run test`, then `/security-review`. Commit and merge.

**Rule:** if a phase goes more than 30 minutes over its time, finish the smallest version that passes its tests, and write the rest in the README "Not done" section.

### Base plan prompt (every phase)

```
/speckit.plan
Follow AGENTS.md and the constitution exactly. The brief in docs/brief.md wins on any conflict.
From phase 2 on: use the schema from phase 1. If this spec needs a schema change, add a new migration and say why.
List every file you will create or change, with its full path.
For each business rule in the spec, name the test that proves it.
Do not add a dependency unless it is listed in phase 0 or you explain why the current stack cannot do it.
Agreed decisions for this phase (do not change them without asking):
<paste the phase's Plan notes here>
```

---

## Phase 0 — Project Setup and Tooling

**Clarify focus:** none expected. This phase has no business rules.

```
/speckit.specify
Set up the empty project for "Aqar Lite" so later phases only add features (see docs/brief.md sections 1 and 5).
This is an infrastructure phase. It has no user-facing features except an empty Arabic RTL home page.

Goals:
- A developer clones the repository and runs `docker compose up`. The database and the app start with no other step.
- The folder structure, code rules and test setup from AGENTS.md exist before any feature code is written.
- Breaking the layer rules (importing the ORM outside repositories, importing server code into client code) fails lint or the build.

Done when:
- `docker compose up` on a clean clone starts PostgreSQL and the app, and the home page shows an Arabic RTL page.
- `npm run lint`, `npm run typecheck`, `npm run test` and `npm run test:integration` all run and pass (with one sample test each).
- A file outside a repository that imports the ORM makes `npm run lint` fail.
- The app refuses to start, with a clear message, if a required environment variable is missing.
```

**Plan notes (agreed):**
```
- npm (not pnpm). Node 22 LTS. Latest stable Next.js (App Router), TypeScript strict, `src/` folder, alias `@/` → `src/`.
- Folders: src/app (routing only), src/features, src/server (db.ts, auth/, http/, audit.ts, env.ts, logger.ts), src/shared (lib/, components/, components/ui/), tests/unit, tests/integration, prisma/.
- All file and folder names kebab-case.
- Dependencies: tailwind, shadcn/ui, sonner, @tanstack/react-query, zod, react-hook-form, @hookform/resolvers, date-fns, @date-fns/tz, prisma + @prisma/client, @node-rs/argon2, pino, server-only, vitest. Nothing else without asking.
- Root layout: `<html lang="ar" dir="rtl">`, Arabic font with next/font (IBM Plex Sans Arabic), Toaster from sonner, QueryClientProvider.
- src/shared/lib/query-client.ts: getQueryClient() → new client per request on the server, one singleton in the browser, default staleTime 30 seconds.
- src/server/db.ts: one Prisma client (singleton) and withTransaction(fn).
- src/server/env.ts: validate all env variables with Zod at startup. `.env.example` lists every variable with no real secrets.
- src/server/logger.ts: pino with redact for password, token, cookie and authorization fields.
- src/server/http/: AppError class, error-codes.ts, and a route wrapper that: checks the session (optional per route), checks the Origin header on POST/PATCH/PUT/DELETE, maps AppError codes to HTTP status, returns `{ data }` or `{ error: { code, message, fieldErrors? } }`, and returns 500 with a generic Arabic message for unknown errors (details only in the log).
- src/shared/lib/error-messages.ts: Arabic message for every error code.
- ESLint: no-restricted-imports so only `*.repository.ts` and `src/server/db.ts` import Prisma; @tanstack/eslint-plugin-query. Prettier.
- Vitest: two configs. Unit tests in tests/unit (no DB). Integration tests in tests/integration use a real Postgres test database (a second database in the same container, created by an init SQL script), never mocks.
- package.json scripts: dev, build, start, lint, typecheck (tsc --noEmit), test, test:integration, db:migrate, db:seed.
- Docker: Dockerfile (Node 22) and docker-compose.yml with `db` (postgres, healthcheck) and `app` (depends_on db healthy). The app entrypoint runs `prisma migrate deploy`, then the seed only if the database is empty, then starts the app.
- next.config: basic security headers (X-Content-Type-Options, X-Frame-Options or frame-ancestors, Referrer-Policy, a simple Content-Security-Policy).
```

---

## Phase 1 — Database Schema and Seed

**Clarify focus:** area as whole square meters or with decimals; unit types list.

```
/speckit.specify
Create the full data model and the seed data for "Aqar Lite" (see docs/brief.md sections 2, 3 and 5).
All later phases use this schema, so it must hold every entity and every integrity rule now.

Entities: Company, User, Session, Unit, Client, Reservation, Contract, Installment, Payment, AuditLog.

Goals:
- Every user belongs to one company and has one role: manager, sales rep or accountant.
- The database itself rejects invalid data (negative prices, duplicate units, overpaid installments, two contracts for one reservation), even if the code has a bug.
- Payments and audit log rows can never be changed or deleted, even with direct SQL.

Seed data:
- 2 companies. Each has 1 manager, 1 accountant and 2 sales reps.
- Each company has at least 10 available units with different types, prices and areas, and at least 3 clients per sales rep.
- Seed passwords are known and listed in the README. Running the seed twice does not create duplicates.

Done when:
- Migrations run on an empty database with no errors.
- Integration tests prove: an UPDATE or DELETE on a payment or an audit row fails; an installment cannot have paidAmount above its amount; a second contract for the same reservation fails.
```

**Plan notes (agreed):**
```
- Minimal fields only. Every field must be needed by a rule in the brief. Anything that can be computed is not stored.
- All ids are UUID (Postgres uuid, default gen_random_uuid()), except Session.id.
- Money is BigInt in halalas. No Float, no Decimal for money.
- Company: id, name.
- User: id, companyId, name, email (unique), passwordHash, role (MANAGER | SALES | ACCOUNTANT).
- Session: id = SHA-256 hash of the token (the raw token is never stored), userId, expiresAt. No role or company here; read them from User.
- Unit: id, companyId, projectName (text), number, type (enum), area, rooms, price, status (AVAILABLE | RESERVED | SOLD).
  unique (companyId, projectName, number); check price > 0, area > 0, rooms >= 0. No projects table.
- Client: id, companyId, salesRepId, name, phone, notes (nullable). NO unique on phone (a unique error would leak another rep's client).
- Reservation: id, companyId, unitId, clientId, salesRepId, expiresAt. No status field: active = expiresAt > now.
- Contract: id, companyId, reservationId (unique), finalPrice, downPayment, installmentCount, approvedAt (nullable; null = draft).
  No status, unitId, clientId or salesRepId: they come from the reservation.
  check finalPrice > 0, downPayment >= 0, downPayment < finalPrice, installmentCount >= 1.
- Installment: id, contractId, seq (0 = down payment), dueDate (date only), amount, paidAmount (default 0).
  unique (contractId, seq); check amount > 0, paidAmount >= 0, paidAmount <= amount. Status is NOT stored.
- Payment: id, contractId, amount, idempotencyKey, createdAt. unique (contractId, idempotencyKey); check amount > 0.
  No allocation table: allocation detail goes in the audit log meta.
- AuditLog: id, companyId (nullable), userId (nullable), action (LOGIN_FAILED | PRICE_CHANGED | CONTRACT_APPROVED | PAYMENT_RECORDED), entityId (nullable), meta (JSON), createdAt.
  companyId and userId are nullable because a failed login with an unknown email has neither. Index to count recent LOGIN_FAILED rows by email.
- Raw SQL inside the migration file: triggers that reject UPDATE and DELETE on payments and audit logs.
- Foreign keys everywhere, no cascade deletes.
- Seed in prisma/seed.ts (outside src, so it may use Prisma directly). Hash seed passwords with Argon2id. Skip if data exists.
```

---

## Phase 2 — Authentication and App Shell

**Clarify focus:** which nav items each role sees.

```
/speckit.specify
Add login, logout and the app shell (see docs/brief.md sections 3.1 and 4).

User stories:
- As a staff user, I log in with email and password and reach the app home page.
- As a staff user, I log out, and my session stops working on the server, not only in my browser.
- As a visitor who is not logged in, I am sent to the login page. API calls without a valid session get 401.

Rules:
- There is no sign-up, no user management screen and no password reset.
- A wrong email and a wrong password show the same message. The response time must not reveal if the email exists.
- After 5 failed logins for one email within 15 minutes, login for that email is blocked for 15 minutes, with the same generic message.
- Every failed login is written to the audit log.
- The app shell is Arabic and RTL. It works on mobile and desktop. The navigation shows only items the user's role can use.
- A request that changes data and comes from another site is refused.

Done when:
- A test proves logout makes the old session token unusable.
- A test proves the 6th failed login within 15 minutes is blocked.
- A test proves a POST with a foreign Origin is refused.
```

**Plan notes (agreed):**
```
- Auth written by hand, no auth library (no Auth.js, no Better Auth).
- Token: 32 random bytes. Store only its SHA-256 hash in Session. Expiry 7 days. Logout deletes the Session row and clears the cookie.
- Cookie: HttpOnly, Secure, SameSite=Lax. Never localStorage.
- Passwords: Argon2id with @node-rs/argon2. For an unknown email, verify against a dummy hash so the time is the same.
- Brute force: count LOGIN_FAILED audit rows for the email in the last 15 minutes. No new table. Document the lockout trade-off in the README.
- requireUser() in src/server/auth: returns { userId, companyId, role } or redirects/401. Every page.tsx calls it. Every API route uses the route wrapper.
- No proxy/middleware for auth. Do not rely on the layout for protection.
- Current user is passed to the client through a small React context from the layout (for showing nav items only, never for security).
```

---

## Phase 3 — Units and Clients

**Clarify focus:** can the accountant view clients (read-only)? Phone format (keep it loose).

```
/speckit.specify
Add unit and client management (see docs/brief.md sections 2, 3.2 and 3.3).

User stories — units:
- As any staff user, I see the list of my company's units. I can filter by status and by price range, sort by price or area, and move between pages.
- As a manager, I add a unit with: project name (free text), unit number, type, area, rooms and price.
- As a manager, I edit a unit. I can change its price only while the unit is available.

User stories — clients:
- As a sales rep, I add a client with name, phone and free-text notes, and I edit my clients.
- As a sales rep, I see only my own clients.
- As a manager, I see all clients of my company.
- The client page shows the notes as plain text.

Rules:
- Filtering, sorting and pagination happen on the server. All query parameters are validated; invalid values return 400.
- A unit has 3 statuses: available, reserved, sold. Nobody can set the status directly; it changes only through reservation, expiry and approval.
- The units list always shows the correct status, even when a reservation expired and nobody opened the system since.
- Changing the price of a reserved or sold unit is refused.
- Every price change is written to the audit log with the old and the new price.
- Sales reps and accountants cannot add or edit units. Accountants cannot edit clients.
- A unit or client from another company returns 404.

Done when:
- Integration tests prove: a user of company A cannot read or edit units or clients of company B; a sales rep cannot read another rep's client; the price of a reserved unit cannot change.
- Lists have loading, empty and error states, and form errors show next to each field.
```

**Plan notes (agreed):**
```
- API: Route Handlers under /api. src/app/api/**/route.ts only re-exports handlers from features/<f>/server/<f>.routes.ts.
- Reads: page.tsx calls requireUser(), parses searchParams with the same Zod schema as the API, then `await queryClient.prefetchQuery(...)` with the key from <f>.keys.ts, calling the service directly (not fetch), then HydrationBoundary. Client: useQuery(queryOptions(...)). No useSuspenseQuery, no streaming.
- Every repository function takes companyId as a required argument (tenant isolation).
- Filters, sort and page in the URL. Offset pagination: default 20, max 50, id as second sort key. Sort field is an allowlist (price, area). placeholderData: keepPreviousData.
- Service and API return the same JSON-safe DTO: money as integer halalas, dates as ISO strings.
- Zod: field rules once in <f>.schemas.ts; input schemas with .pick() only, never .omit(). companyId, salesRepId and status are never in an input schema.
- Price change: in one transaction, update the price only WHERE status = 'AVAILABLE', and write PRICE_CHANGED with old and new price in meta.
- releaseExpired(companyId) lives in the units feature (it changes unit status): one SQL UPDATE that sets RESERVED units back to AVAILABLE when they have no reservation with expiresAt > now. Call it before reading units. This keeps the dependency direction (units never import reservations).
- Clients: salesRepId comes from the session. No unique check on phone.
- Forms: React Hook Form + zodResolver with the shared schema. API 400 fieldErrors → setError. shadcn plain Table.
- Components follow the folder rule in AGENTS.md (kebab-case, hook only for client logic, index.ts exports the component only, no empty files).
```

---

## Phase 4 — Reservations

**Clarify focus:** can a client have more than one active reservation? Where does the rep see his reservations?

```
/speckit.specify
Add unit reservations (see docs/brief.md sections 2 and 3.4).

User stories:
- As a sales rep, I reserve an available unit for one of my own clients.
- As a sales rep, I see my active reservations and when each one expires.
- As a manager, I see all active reservations in my company.

Rules:
- A reservation is valid for 72 hours from the moment it is created.
- After 72 hours, if no contract was approved, the unit is available again with no manual action.
- A unit can have at most one active reservation.
- When two sales reps reserve the same unit at the same moment, exactly one succeeds. The other gets a clear Arabic message that the unit was just reserved.
- A sales rep cannot reserve for a client who belongs to another rep.
- Only sales reps can reserve. Reservations cannot be cancelled by hand (out of scope).

Done when:
- A test sends two reservation requests for the same unit in parallel and proves only one succeeds.
- A test proves an expired reservation makes the unit available again.
- A test proves a rep cannot reserve for another rep's client.
```

**Plan notes (agreed):**
```
- Expiry is lazy: call units releaseExpired() first, then reserve. No cron job.
- Reserve in one transaction: one conditional UPDATE on the unit (WHERE id AND companyId AND status = 'AVAILABLE'). 0 rows → AppError UNIT_NOT_AVAILABLE (409). Then insert the reservation with expiresAt = now + 72 hours.
- Check the client belongs to the session user (salesRepId) before reserving.
- The concurrency test uses Promise.all against a real Postgres (tests/integration).
```

---

## Phase 5 — Contracts and Installment Schedule

**Clarify focus:** minimum and maximum number of installments.

```
/speckit.specify
Add contracts and the installment schedule (see docs/brief.md sections 2 and 3.5).

User stories:
- As a sales rep, I create a draft contract from my active reservation. I enter the final price, the down payment and the number of monthly installments, and I see a preview of the schedule before I save.
- As a sales rep, I edit my draft while it is not approved yet.
- As an accountant, I see all contracts of my company and I approve a draft.
- As any allowed user, I open a contract and see its schedule: each installment with due date, amount, paid amount and status, and the remaining amount of the contract.

Rules:
- A reservation can have only one contract.
- The final price cannot be lower than 95% of the unit price (maximum discount 5%).
- The down payment is less than the final price. The number of installments is at least 1.
- Down payment + installments = final price exactly.
- The down payment is due on the approval date. If the down payment is 0, there is nothing due on that day.
- A contract that starts on 31 January has its next installment due in February (at the end of February).
- Approval is refused if the reservation has expired.
- Approval checks that the draft did not change after the accountant opened it. If it changed, approval is refused with a clear message.
- On approval, the contract becomes approved, the unit becomes sold and the schedule is created, all together or not at all.
- An approved contract cannot be edited.
- Installment status is shown as: unpaid, partial, paid or overdue.
- Only the sales rep who owns the reservation creates and edits the draft. Only accountants approve. Sales reps see only their own contracts.

Done when:
- Unit tests cover: 31 January start, a leap-year February, rounding (100,000 over 3), down payment 0, and the sum always equal to the final price.
- An integration test proves approval is all-or-nothing, and that an approved contract cannot be edited.
```

**Plan notes (agreed):**
```
- Schedule is a pure function in features/contracts/domain/schedule.ts. The draft form uses the same function for the preview.
- Minimum price = Math.ceil(unitPrice * 95 / 100) in integer halalas. No float math.
- Installments in whole riyals; the remainder goes to the last installment.
- Down payment = installment seq 0, due on the approval date. Not created when the down payment is 0.
- Start date = approval date in Asia/Riyadh. Installment i due = addMonths(start, i) from the START date (date-fns + @date-fns/tz). Missing day → last day of the month.
- Status computed on read in a domain function: paid if paidAmount = amount; overdue if dueDate < today (Asia/Riyadh) and not fully paid (overdue wins over partial); partial if paidAmount > 0; else unpaid. Never stored.
- Draft edit: UPDATE ... WHERE approvedAt IS NULL. 0 rows → CONTRACT_ALREADY_APPROVED (409).
- Approve, in withTransaction: SELECT the contract FOR UPDATE; check the reservation is still active; compare finalPrice, downPayment and installmentCount sent by the accountant with the locked row (mismatch → CONTRACT_CHANGED 409); set approvedAt; unit RESERVED → SOLD (conditional update); insert installments; write CONTRACT_APPROVED audit row.
```

---

## Phase 6 — Payments

**Clarify focus:** can a sales rep see payments on his own contracts (read-only)? Payment date is always "now" (assumption).

```
/speckit.specify
Add payments (see docs/brief.md sections 2 and 3.6).

User stories:
- As an accountant, I record a payment of any amount on an approved contract.
- As an accountant or manager, I see the payments of a contract and how the schedule changed.

Rules:
- A payment is allocated to the oldest unpaid installments first (the down payment first). Each installment becomes partial or paid.
- A payment cannot be more than the remaining amount of the contract. A larger amount is refused with a clear message.
- Clicking "Save" twice or resending the request after a network failure must not create two payments. The same request returns the same result.
- Two accountants recording payments on the same contract at the same moment must never pay more than the remaining amount.
- A recorded payment cannot be edited or deleted by anyone.
- Every payment is written to the audit log, including how it was allocated to installments.
- Only accountants record payments. Payments on contracts of another company return 404.

Done when:
- Unit tests cover: a partial payment, a payment that covers several installments, and an exact final payment.
- Integration tests prove: a repeated request with the same key creates one payment; overpayment is refused; a sales rep cannot record a payment.
```

**Plan notes (agreed):**
```
- Allocation is a pure function in features/payments/domain/allocation.ts.
- The client sends an `Idempotency-Key` header. The payment form creates it once with crypto.randomUUID() and makes a new one only after success.
- In withTransaction: SELECT the contract FOR UPDATE; if (contractId, idempotencyKey) exists, return that payment; check amount <= remaining; insert the payment; update paidAmount of each installment (oldest seq first); write PAYMENT_RECORDED with the allocation list in meta.
- No update or delete endpoints for payments. The DB triggers from phase 1 are the last guard.
- Payments use contracts only through contracts/server/index.ts (dependency direction).
```

---

## Phase 7 — Audit Log, Hardening and Delivery

**Clarify focus:** which filters the audit log page needs (keep it minimal).

```
/speckit.specify
Finish the system for delivery (see docs/brief.md sections 2, 4, 5 and 6).

User stories:
- As a manager, I read my company's audit log: failed logins, price changes, contract approvals and payments, newest first, with pages.
- As a reviewer, I clone the repository on a clean machine, run `docker compose up`, and use the system with the seed accounts.

Rules:
- Only managers can read the audit log. Nobody can edit or delete it.
- `npm audit` shows no high or critical vulnerabilities.
- No secrets in the repository or its git history. `.env.example` lists every variable.
- The README has: how to run, seed accounts per role, technical decisions (what, why, rejected alternative), assumptions, the 3 main security risks and how each is handled, how company isolation is guaranteed, what is not done and how it would be done, and where AI tools were used.

Extra (only if everything above is done and all tests pass):
- One Playwright E2E test for: reservation, then contract, then approval, then payment.
- GitHub Actions running lint, typecheck and tests.

Done when:
- A fresh clone in a new folder starts with `docker compose up`, and the full flow works by hand with the seed accounts.
- All tests pass, and `/security-review` shows no open issues.
```

**Plan notes (agreed):**
```
- Failed logins with an unknown email have no companyId. Show only rows of the manager's company.
- README "Security" top 3 risks: cross-company data leak (IDOR), privilege escalation / mass assignment, duplicated money operations (double reservation, double payment).
- README "Technical decisions" comes from the decisions in AGENTS.md and the plan notes of every phase.
- Test the clean clone in a new folder before the final commit.
```
