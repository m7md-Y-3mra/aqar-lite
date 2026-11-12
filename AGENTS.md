# AGENTS.md

<!--
This file loads into context on EVERY message. CLAUDE.md imports it, so all agents follow the same rules.
Apply the Golden Test before adding any rule:
"Would removing this cause the AI to make mistakes?" If not — cut it.
Do not restate framework defaults. Only write rules that override defaults or record decisions for this project.
-->

This is a hiring test. The brief is in `docs/brief.md`. If a rule here conflicts with the brief, the brief wins — stop and ask.
Quality, correctness and security beat feature count. Never build out-of-scope items: dashboard, export, file upload, contract cancel, CRM stages, user management, password reset.

---

# Section A — General Engineering Rules

## 1) Layers (YOU MUST FOLLOW)
- Request flow: `<f>.routes.ts` → `<f>.service.ts` → `<f>.repository.ts`. Never skip a layer.
- Routes: auth wrapper, Zod parse, call the service, return the response. No business rules.
- Services: all business rules, role and ownership checks, transactions. No `Request`/`Response` objects.
- Repositories: Prisma queries only. They accept an optional `tx` so one service can run one transaction across repositories.
- Only `*.repository.ts` and `src/server/db.ts` may import Prisma.
- Services start a transaction with `withTransaction(async (tx) => ...)` from `src/server/db.ts`, and pass `tx` to each repository. Services never call Prisma methods directly.
- Pure calculations (schedule, allocation) live in `src/features/<f>/domain/` with no DB or framework imports.

## 2) Features and Dependencies
- Feature code lives in `src/features/<f>/`: `server/`, `client/`, `domain/`, `<f>.schemas.ts`, `<f>.types.ts`, `<f>.keys.ts`.
- `src/app/` is routing only: `page.tsx` renders one feature component; `api/**/route.ts` only re-exports handlers from `<f>.routes.ts`.
- Backend infrastructure (db, auth, http wrapper, audit, env, logger) lives in `src/server/`. Code used by both sides lives in `src/shared/`.
- Every file in `src/server/` and `src/features/*/server/` starts with `import "server-only"`.
- Features import each other only through `server/index.ts`, in one direction: payments → contracts → reservations → units, clients. Any feature may use auth and audit. No cycles.
- A client component never imports from another feature. Move shared UI to `src/shared/components/`.

## 3) Multi-Tenancy and Permissions (IMPORTANT)
- `companyId` and `userId` come from the session only. Never read them from body, query or params.
- Every repository function takes `companyId` as a required argument and filters by it.
- A record from another company returns 404, not 403.
- Check role AND ownership in the service for every operation. A sales rep sees only his own clients, reservations and drafts.
- Never pass the request body to Prisma directly. Use the parsed input only.

## 4) Money and Dates (IMPORTANT)
- Money is integer halalas: `BigInt` in the DB, `number` in code and JSON. Never float.
- Convert riyals ⇄ halalas only in `src/shared/lib/money.ts`.
- Installments are whole riyals. The remainder goes to the last installment. The sum must equal the final price exactly.
- Down payment is installment `seq 0`, due on the approval date. Do not create it when the down payment is 0.
- Final price ≥ unit price × 0.95. Round the minimum up.
- Contract start = approval date in `Asia/Riyadh`. Due date of installment `i` = `addMonths(start, i)`, always from the start date, never from the previous installment. If the day does not exist, use the last day of the month.
- "Today" means today in `Asia/Riyadh`. Use `date-fns` with `@date-fns/tz`.
- Installment status (paid, partial, overdue) is computed on read. Never store it.

## 5) Concurrency and Data Integrity
- Reserve with one conditional update (`WHERE status = 'AVAILABLE'`). 0 rows → `UNIT_NOT_AVAILABLE` (409).
- Reservation expiry is lazy: call `releaseExpiredReservations()` before reading units or reserving. No cron job.
- A draft can be edited only while `approvedAt IS NULL` (put the condition in the UPDATE).
- Approval: lock the contract row (`FOR UPDATE`), check the reservation is still active, and compare the values the accountant saw. Mismatch → `CONTRACT_CHANGED` (409).
- Approval runs in ONE transaction: contract, unit status, installments, audit log.
- Payment runs in ONE transaction: lock the contract row, check the idempotency key, allocate to the oldest unpaid installment first, write the audit log. Amount above the remaining total → reject.
- Payments need the `Idempotency-Key` header. Unique `(contractId, idempotencyKey)`. A repeated key returns the existing payment.
- Payments and audit logs are never updated or deleted. DB triggers enforce this. Do not write update or delete code for them.
- Integrity rules also go in the DB (check, unique, foreign key). Change the schema only with `prisma migrate dev`. Raw SQL (triggers, checks) goes inside the migration file. Never edit an applied migration.

## 6) Errors
- Services `throw new AppError(code)`. Codes live in `src/server/http/error-codes.ts`, Arabic messages in `src/shared/lib/error-messages.ts`.
- The route wrapper maps codes to HTTP status. Unknown errors → 500 with a generic Arabic message. Details go to the logger only.
- Response shape: `{ data }` or `{ error: { code, message, fieldErrors? } }`.

## 7) Security
- Auth is written by hand, no auth library. DB sessions: 32-byte random token, store only its SHA-256 hash, 7-day expiry. Logout deletes the session row.
- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`. Never store tokens in `localStorage`.
- Passwords: Argon2id with `@node-rs/argon2`. For an unknown email, still verify a dummy hash so the response time is the same.
- Login: block an email after 5 failed attempts in 15 minutes (count `LOGIN_FAILED` audit rows). Use one generic error message for every failure.
- Mutating API routes check the `Origin` header (CSRF).
- Every `page.tsx` calls `requireUser()`. Every API route uses the auth wrapper. Do not use proxy or middleware for auth.
- Use the pino logger with `redact` for password, token and cookie fields. Never use `console.log` in server code.
- Write audit rows for: failed login, price change, contract approval, payment.

## 8) Testing
- Tests live in `tests/unit/` and `tests/integration/`, and mirror the `src/` paths.
- Integration tests use a real Postgres. Never mock the DB.
- Required tests: schedule (31 January case, rounding), payment allocation (partial, across installments), tenant isolation, concurrent reservation with `Promise.all`, repeated payment with the same key.

## 9) Change Discipline and Git
- Make the smallest change that solves the task. Do not refactor unrelated code.
- Do not add a package without asking first.
- Commit after each working step with a small Conventional Commit (`feat:`, `fix:`, `test:`). Never one big commit.
- If a business rule is unclear, ask. Record the decision in the README "Assumptions" section.

---

# Section B — Next.js / React Rules

## Data Flow
- No Server Actions. Mutations go `useMutation` → `/api` → `invalidateQueries` with keys from `<f>.keys.ts`.
- Prefetch in `page.tsx`: `requireUser()` → parse `searchParams` with the feature Zod schema → `prefetchQuery` with the SAME key factory → call the service directly (never `fetch` your own API) → wrap in `<HydrationBoundary>`.
- Client reads with `useQuery(<name>Options(...))` built with `queryOptions()`. Get the client from `src/shared/lib/query-client.ts`.
- The service and the API must return the same JSON-safe DTO: integers and ISO date strings. No `BigInt` or `Date` in a DTO.
- Filters, sort and page live in the URL. Pagination is offset-based: default 20, max 50, `id` as the second sort key. Use `placeholderData: keepPreviousData`.
- No global store (Zustand, Redux). Local UI state uses `useState`.

## Validation and Forms
- Each `<f>.schemas.ts` defines the field rules once. Input schemas are built with `.pick()`. Never use `.omit()`.
- Never put `companyId`, `salesRepId`, `passwordHash`, `status` or `approvedAt` in an input schema.
- Forms use React Hook Form + `zodResolver` with the same schema the API uses.
- API 400 `fieldErrors` → `setError` on each field. 409 → message at the top of the form.
- The payment form creates its idempotency key once with `crypto.randomUUID()` and makes a new one only after success.

## Components
- All file and folder names are kebab-case.
- One folder per component: `name/` → `name.tsx`, `use-name.ts` (client logic only), `types.ts`, `constants.ts`, `index.ts`.
- `index.ts` re-exports only this component and its types. No barrel files at feature level or higher.
- Private child components go in a nested `components/` folder with the same layout. Max 2 nested levels.
- Create `types.ts`, `constants.ts` or the hook only when there is content for it. No empty files.
- Server components never use hooks.

## UI
- shadcn/ui with the plain `Table` (no TanStack Table). Toasts with `sonner`.
- Arabic only: write Arabic text in the components. No i18n library.
- RTL: use logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `ml-`, `mr-`, `left-`, `right-`.
- Every data view has loading, empty and error states. Validation errors show next to the field.

## Commands
- `docker compose up` must start DB, migrations, seed and app on a clean clone.
- Integration tests need the DB first: `docker compose up -d db`, then `npm run test:integration`.
- Before you say a task is done: `npm run lint && npm run typecheck && npm run test`.
