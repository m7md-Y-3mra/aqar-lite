---

description: "Task list for phase 2: login, logout and app shell"
---

# Tasks: Login, Logout and App Shell

**Input**: Design documents from `specs/003-auth-app-shell/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api-auth.md](./contracts/api-auth.md), [contracts/ui-shell.md](./contracts/ui-shell.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The user's "done when" items (logout token replay, 6th login locked, foreign `Origin` refused) and spec FR-031 need integration tests on a real Postgres. Each test must be able to fail: the 6th login uses the **correct** password, logout replays the **raw** token kept from before logout, and every refused-origin case has an accepted same-origin control.

**Organization**: Session plumbing (token, session lookup, route wrapper, `requireUser()`) is needed by every story, so it is built in Phase 2. Stories then run in this order: US1 → US2 → US4 → US3 → US5 → US6. All the P1 stories have equal priority. US4 comes before US3 because the logout test replays the token against `GET /api/auth/me`, which US4 adds.

**Commits**: one small Conventional Commit per task or per closely related pair (AGENTS.md §9), with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Time budget**: 2 h (docs/phases.md). If more than 30 minutes over: finish US1–US5 (all "done when" items), make US6 a plain header + Home link + logout button, and write the rest in README "Not done".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US6 from spec.md

## Rules that apply to every task

- Every file in `src/server/**` and `src/features/*/server/**` starts with `import "server-only"`. Only `*.repository.ts` imports Prisma. Raw SQL is only tagged templates (`$queryRaw\`…\``, `$executeRaw\`…\``) in repositories, never string-built.
- Services get the time once (`const now = new Date()`) and pass it on. Never mix it with the DB `now()` (research R6).
- Never log, return or store the password, the raw token, the cookie value or `passwordHash`. No `console.log` in `src/`.
- Shared code (`src/shared/**`) never imports from `src/features/**` or `src/server/**`. Client components use only logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
- Test files get the DB from `@/server/db` (`getDb()`) and never import the generated Prisma client. Integration tests call route handlers directly with `new Request("http://localhost:3000/…", { method, headers, body })`.
- `SessionUser = { userId, companyId, role, name, companyName }` (docs/phases.md agreed shape). `ShellUser = { name, role, companyName }`.
- Error responses keep the phase 0 shape `{ error: { code, message, fieldErrors? } }`. The client branches on `error.code`, never on the status alone.
- After each task: `npm run lint && npm run typecheck` and the tests touched by the task must pass before the commit.

---

## Phase 1: Setup (Prerequisites)

**Purpose**: Clean baseline and the approved UI dependency.

- [x] T001 Baseline: `npm ci`, `npm run db:generate`, `docker compose up -d db`, then `npm run lint && npm run typecheck && npm run test && npm run test:integration`. All must pass before any change. If anything fails, STOP and tell the user.
- [x] T002 Add shadcn primitives (approved, research R13): run the shadcn CLI `add button input label card sheet` with the existing `components.json` (`radix-nova`, `rtl: true`). Then:
  - in `package.json`, pin `radix-ui` (and any other package the CLI added) to the exact installed version, with no `^` or `~`, and run `npm install` to update `package-lock.json`;
  - check that the files land in `src/shared/components/ui/` with kebab-case names, and use only logical classes (replace any `ml-`/`mr-`/`left-`/`right-`/`pl-`/`pr-`);
  - keep any CSS variables or `@import`s in `src/app/globals.css` that the generated components use; revert only CLI changes to unrelated files (`layout.tsx`, rewrites of `src/shared/lib/utils.ts`, components not listed above);
  - `npm audit --audit-level=high` shows no high or critical issues.

  Delete `src/shared/components/ui/.gitkeep`. Commit `chore: add radix-ui and shadcn primitives`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Session token, password check, session lookup, the route wrapper session gate, `requireUser()`, and test helpers. Every user story depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Add `INVALID_CREDENTIALS: 401` to `src/server/http/error-codes.ts`, and `INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة"` to `src/shared/lib/error-messages.ts`. `tests/unit/shared/lib/error-messages.test.ts` already checks that the keys match; run it.
- [x] T004 [P] Create `src/shared/lib/roles.ts`: `ROLES = ["MANAGER", "SALES", "ACCOUNTANT"] as const`, `type Role`, `ROLE_LABELS: Record<Role, string>` (مدير، مندوب مبيعات، محاسب). Test `tests/unit/shared/lib/roles.test.ts`: read `prisma/schema.prisma` as text, parse the `enum Role { … }` block, and assert it equals `ROLES` (no generated-client import).
- [x] T005 [P] Write `tests/unit/server/auth/session-token.test.ts` first, then `src/server/auth/session-token.ts`:
  - `SESSION_COOKIE = "aqar_session"`, `SESSION_TTL_MS = 7 days`;
  - `generateSessionToken()`: `randomBytes(32).toString("base64url")`, 43 chars;
  - `hashSessionToken(token)`: sha256 lowercase hex, 64 chars, matching `/^[0-9a-f]{64}$/`;
  - `sessionExpiresAt(now)` = now + 7 days;
  - `buildSessionCookie(token)` = `aqar_session=<token>; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`;
  - `buildClearedSessionCookie()`: same attributes, empty value, `Max-Age=0`;
  - `readSessionToken(cookieHeader: string | null)`: returns the `aqar_session` value or `null`. It ignores other cookies and returns `null` for an empty value or one longer than 128 chars.

  Tests cover each function, including two tokens never being equal and a header with several cookies.
- [x] T006 [P] Write `tests/unit/server/auth/password.test.ts` first, then `src/server/auth/password.ts`:
  - `verifyPassword(hash, password)`: wraps `@node-rs/argon2` `verify`; returns `false` when it throws (research R3).
  - `DUMMY_PASSWORD_HASH`: a hard-coded constant. Generate it once with `node -e` and `hash()` defaults on a random throwaway string, and paste the result. Comment: same defaults as `prisma/run-seed.ts`; never computed at runtime.

  Tests:
  - `verifyPassword("fixture-password-hash", "x")` → `false` (no throw);
  - `DUMMY_PASSWORD_HASH` starts with `$argon2id$v=19$m=19456,t=2,p=1$`;
  - `verifyPassword(DUMMY_PASSWORD_HASH, "anything")` → `false`;
  - a fresh `hash("pw")` verifies `true` for `"pw"`.
- [x] T007 Create `src/server/auth/session.repository.ts`. Each function takes an optional `tx` (default `getDb()`):
  - `createSession({ id, userId, expiresAt }, tx?)`;
  - `findSessionWithUser(id, tx?)`: selects `expiresAt` and user `id`, `name`, `role`, `companyId`, and company `name`. **Never** selects `passwordHash`.
  - `deleteSession(id, tx?)`: `deleteMany({ where: { id } })`, so a missing row is not an error.

  Add a comment: these take no `companyId` because they establish the tenant (plan exception E1).
- [x] T008 Create `src/server/auth/session.service.ts`:
  - `type SessionUser = { userId, companyId, role, name, companyName }`.
  - `getSessionUser(token: string | null, now = new Date()): Promise<SessionUser | null>`: `null` token → `null`; otherwise hash it, look it up, and return `null` unless `expiresAt > now`.
- [x] T009 Create `src/server/auth/request-user.ts` with `getRequestUser(req: Request)` = `getSessionUser(readSessionToken(req.headers.get("cookie")))`. Create `src/server/auth/require-user.ts`:
  - `getCurrentUser = cache(async () => getSessionUser((await cookies()).get(SESSION_COOKIE)?.value ?? null))`;
  - `requireUser()`: returns the user or calls `redirect("/login")`.

  Both files start with `import "server-only"`.
- [x] T010 Change `src/server/http/route-handler.ts` (contracts/api-auth.md "Route wrapper change"):
  - Order: origin check (unchanged) → for `auth: "user"`, `const user = await getRequestUser(req)`; no user → `AppError("UNAUTHORIZED")` → handler.
  - Type the options so a `"user"` handler receives `(req, ctx, user: SessionUser)`, and a `"public"` handler `(req, ctx)`.
  - Remove the "Phase 2" comment.

  Update `tests/unit/server/http/route-handler.test.ts`:
  - mock `@/server/auth/request-user`;
  - a `user` route with no user → 401 `UNAUTHORIZED` and the handler is not called;
  - with a user → the handler gets it;
  - a foreign `Origin` on a `user` POST → 403 and `getRequestUser` is **not** called;
  - keep all existing cases green.
- [x] T011 [P] Add test helpers:
  - `tests/integration/support/db-fixtures.ts`:
    - `makeUserWithPassword(companyId, password, role?)`: real `hash()`; returns the user and its email;
    - `makeLoginFailure({ email, reason, createdAt, userId?, companyId? })`: inserts a `LOGIN_FAILED` audit row with `meta: { email, reason }`, and asserts that `email` is already trimmed and lowercase;
    - `makeSession(userId, expiresAt)`: returns the **raw token** and inserts the hashed id.
  - `tests/integration/support/http.ts`:
    - `apiRequest(path, { method, body?, origin?, cookie? })` builds a `Request`. The default origin is `http://localhost:3000`; `origin: null` omits the header.
    - `readJson(res)` and `getSetCookie(res)`.
  - `tests/integration/support/audit.ts`: `loginFailures(email)` returns the `LOGIN_FAILED` rows for that email, ordered by `createdAt`, through `$queryRaw` on `meta->>'email'`.
- [x] T012 Gate: `npm run lint && npm run typecheck && npm run test && npm run test:integration` all pass. Commit T003–T012 in small commits (`feat: add session token and password helpers`, `feat: resolve session user in route wrapper`, `test: add auth fixtures`).

**Checkpoint**: sessions can be created and resolved, and `user` routes really check them. No login endpoint yet.

---

## Phase 3: User Story 1 - Log in and reach the home page (Priority: P1) 🎯 MVP

**Goal**: A seed user logs in with email and password and lands on a welcome home page that shows their name, role and company.

**Independent Test**: With the seed loaded, log in as each of the 8 seed accounts and confirm each reaches `/` showing the right name, role and company (quickstart §2).

### Tests for User Story 1 (write first; they must FAIL before T015–T018)

- [x] T013 [P] [US1] `tests/unit/features/auth/auth.schemas.test.ts`:
  - `" Ali@X.test "` → `"ali@x.test"`;
  - a malformed email, an empty email, an empty password, a 255-char email and a 129-char password each fail with a field error under the right key;
  - the password is not trimmed;
  - extra keys (`companyId`, `role`) are dropped from the parsed result.
- [x] T014 [P] [US1] `tests/integration/features/auth/login.test.ts`, success and basic-failure cases. Setup: a company and a user from `makeUserWithPassword`. Cases:
  - correct login → 200; `{ data: { name, role, companyName } }` exactly, with no `token`, `id`, `userId`, `companyId` or `passwordHash`;
  - `Set-Cookie` has `aqar_session=<43 chars>`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=604800`;
  - exactly one new session whose `id` = sha256(cookie token), and whose `expiresAt` is 7 days ± 5 s from now;
  - the email in upper case with spaces → 200;
  - two logins → two sessions;
  - wrong password → 401 `INVALID_CREDENTIALS` and no session;
  - malformed body (not JSON) and invalid fields → 400 `VALIDATION_ERROR` with `fieldErrors`.

### Implementation for User Story 1

- [x] T015 [US1] Create `src/features/auth/auth.schemas.ts`:
  - `authFields` is a `z.object` with `email` (string → trim → lowercase → email format, max 254, Arabic message "أدخل بريدًا إلكترونيًا صحيحًا") and `password` (string, min 1 "أدخل كلمة المرور", max 128 "كلمة المرور طويلة جدًا").
  - `loginSchema = authFields.pick({ email: true, password: true })`. Never `.omit()`.
  - The schema must work with `zodResolver` in the client: no server imports.

  Create `src/features/auth/auth.types.ts` with `LoginInput = z.infer<typeof loginSchema>`.
- [x] T016 [US1] Create `src/features/auth/server/auth.repository.ts` with `findUserByEmail(email, tx)`. It selects `id`, `name`, `role`, `companyId`, `passwordHash` and company `name`, and takes no `companyId` (exception E1, comment).
- [x] T017 [US1] Create `src/features/auth/server/auth.service.ts` with `login(input: LoginInput, now = new Date())`:
  - `withTransaction`: find the user; `ok = user ? await verifyPassword(user.passwordHash, input.password) : (await verifyPassword(DUMMY_PASSWORD_HASH, input.password), false)`; if ok, create a session (`hashSessionToken(token)`, `sessionExpiresAt(now)`) with `tx`; return a result object.
  - After the transaction: not ok → `throw new AppError("INVALID_CREDENTIALS")`. Ok → return `{ token, user: ShellUser }`.
  - US2 extends this function. Keep the "decide inside the transaction, throw outside" shape.
- [x] T018 [US1] Create `src/features/auth/server/auth.routes.ts` with `loginHandler = handleRoute({ auth: "public", handler })`:
  - the handler does `loginSchema.parse(await readJson(req))` → `login()` → `Response.json({ data: user }, { headers: { "Set-Cookie": buildSessionCookie(token) } })`.

  Create `src/app/api/auth/login/route.ts` containing only `export { loginHandler as POST } from "@/features/auth/server/auth.routes";`. Run T014: it must pass.
- [x] T019 [P] [US1] Create `src/shared/components/current-user/`:
  - `types.ts`: `ShellUser`;
  - `current-user.tsx` (`"use client"`): `CurrentUserProvider({ user, children })` and the context;
  - `use-current-user.ts`: throws if used outside the provider;
  - `index.ts`.

  Create `src/shared/components/home-welcome/` (`home-welcome.tsx`, `index.ts`): "مرحبًا، {name}" with `ROLE_LABELS[role]` and the company name. No statistics.
- [x] T020 [US1] Create `src/features/auth/client/login-form/` per contracts/ui-shell.md "Login page":
  - `use-login-form.ts`: RHF + `zodResolver(loginSchema)` + `useMutation` → `fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body })`.
    - On success: `getQueryClient().clear()`, `router.replace("/")`, `router.refresh()`.
    - `VALIDATION_ERROR` → `setError` per field.
    - `INVALID_CREDENTIALS` → the root error with the generic message.
    - Anything else or a network error → "تعذر تسجيل الدخول، حاول مرة أخرى".
  - `login-form.tsx`: shadcn `Card`, `Label`, `Input` (email with `dir="ltr"`, `autoComplete="username"`; password with `autoComplete="current-password"`) and `Button`. The button is disabled with "جارٍ تسجيل الدخول…" while pending. Field errors under the fields (`aria-invalid`, `aria-describedby`); the root error in `role="alert"`.
  - `index.ts`.
- [x] T021 [US1] Create `src/app/login/page.tsx`: `const user = await getCurrentUser(); if (user) redirect("/");`, then a centred page rendering `<LoginForm />`. Comment: this page is exception E2 (no `requireUser()`).
- [x] T022 [US1] Move the home page into the authenticated group:
  - Delete `src/app/page.tsx`.
  - Create `src/app/(app)/layout.tsx`: `const user = await requireUser();` → `<CurrentUserProvider user={toShellUser(user)}>{children}</CurrentUserProvider>`. US6 adds the shell.
  - Create `src/app/(app)/page.tsx`: `const user = await requireUser();` → `<HomeWelcome user={toShellUser(user)} />`.
  - Put `toShellUser(user: SessionUser): ShellUser` in `src/server/auth/session.service.ts`.
- [ ] T023 [US1] Check: `npm run build` succeeds. With `docker compose up` (or `npm run dev`), log in as `manager@ufuq.test` and see the welcome, then open `/login` and get sent to `/`. Commit (`feat: add login endpoint and login page`, `feat: add authenticated home page`).

**Checkpoint**: US1 works on its own. Failed logins are not yet audited or locked.

---

## Phase 4: User Story 2 - Failed logins are generic, throttled and audited (Priority: P1)

**Goal**: Every failed login is audited with a reason. After 5 `invalid_credentials` failures in 15 minutes the email is locked, even for the correct password. `locked` attempts never extend the lock, and every failure path takes the same time.

**Independent Test**: 5 wrong passwords for one email, then the correct one → 401 with the same message; the audit log has 5 `invalid_credentials` + 1 `locked` rows (quickstart §1, `login-lock.test.ts`).

### Tests for User Story 2 (write first; they must FAIL before T027–T030)

- [x] T024 [P] [US2] In `tests/integration/prisma/schema-constraints.test.ts`, add:
  - a `LOGIN_FAILED` row with `meta.reason = "bad"` or with no reason → `expectDbError` `23514` with constraint `audit_logs_login_failed_reason_check`;
  - positive controls `invalid_credentials` and `locked` insert fine.
- [x] T025 [US2] Extend `tests/integration/features/auth/login.test.ts`:
  - an unknown email and a wrong password give bodies that are `toEqual` each other, with the same status (401);
  - each writes exactly one `LOGIN_FAILED` row with `meta = { email: <normalized>, reason: "invalid_credentials" }`. The known email row has `userId` + `companyId`; the unknown one has both `null`;
  - invalid input (400) writes **no** row;
  - no audit row's `meta` contains the submitted password string;
  - a successful login writes no row;
  - tenant (constitution I): users in companies A and B each fail once; each row carries its own user's `companyId`, never the other company's;
  - server error (FR-030, SC-006, edge case "database down"): in its own file `tests/integration/features/auth/login-errors.test.ts` (module mocks apply to the whole file), `vi.mock` the auth repository so `findUserByEmail` rejects (ESM exports cannot be `vi.spyOn`-ed), and `vi.mock("@/server/logger")` to return `createLogger(<in-memory stream>)`. Expect 500 `INTERNAL_ERROR` with the generic message, no `Set-Cookie`, no session, and the captured log contains neither the submitted password nor any `aqar_session` value. This case may pass before T027–T030; it guards against regressions.
- [x] T026 [US2] Create `tests/integration/features/auth/login-lock.test.ts`. Each case uses its own fresh user/email. Cases:
  1. 4 wrong → the correct password → 200.
  2. 5 wrong → the 6th with the **correct** password → 401 `INVALID_CREDENTIALS`, no new session, the last row has `reason: "locked"`. Rows: exactly 5 `invalid_credentials` + 1 `locked`.
  3. Locked retries do not extend the lock:
     - `makeLoginFailure` × 5 with `createdAt = now − 14 min`;
     - 5 correct-password attempts → all 401, written as `locked`;
     - `vi.useFakeTimers({ toFake: ["Date"] })`, `vi.setSystemTime(now + 2 min)`;
     - correct password → 200, which can only pass if the 5 recent `locked` rows are not counted;
     - restore the timers in `afterEach`.
  4. 5 `invalid_credentials` rows from `makeLoginFailure` 16 min ago → the correct password → 200 (old failures expire).
  5. An unknown email: 5 wrong → the 6th → 401, and its row has `reason: "locked"`.
  6. Case and spaces: failures sent as `Ali@…`, ` ali@… ` and `ALI@…` count for one email; the 6th attempt is locked.
  7. Email A locked → email B with the correct password → 200.
  8. Parallel: `Promise.all` of 8 wrong-password logins for one email → all 401; exactly 5 `invalid_credentials` + 3 `locked` rows.

### Implementation for User Story 2

- [x] T027 [US2] Run `npx prisma migrate dev --name login_failed_reason_check --create-only`. Put exactly the SQL from data-model.md "New migration" in the new `migration.sql`, under `-- Raw SQL: Prisma cannot express CHECK constraints`. Apply it with `npx prisma migrate dev`. T024 must now pass. Commit `feat: check failed-login audit reason in the database`.
- [x] T028 [P] [US2] Create `src/server/audit/audit.repository.ts`:
  - `insertAuditLog({ action, companyId, userId, entityId, meta, createdAt }, tx)`;
  - `countRecentLoginFailures(email, since, tx)`: `$queryRaw` with exactly `action = 'LOGIN_FAILED' AND meta->>'email' = ${email} AND meta->>'reason' = 'invalid_credentials' AND created_at > ${since}`, returning a `number` (convert the `bigint` count). The expression matches the phase 1 index (research R5).

  Comment: keyed by email, no `companyId` (exception E1).
- [x] T029 [US2] Add `lockLoginEmail(email, tx)` to `src/features/auth/server/auth.repository.ts`: `` tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))` `` (research R4; `$executeRaw` because the function returns `void`).
- [x] T030 [US2] Extend `login()` in `src/features/auth/server/auth.service.ts` to the full flow (research R4). Constants: `LOGIN_LOCK_THRESHOLD = 5`, `LOGIN_LOCK_WINDOW_MS = 15 min`, `LOGIN_FAILURE_REASON = { invalidCredentials: "invalid_credentials", locked: "locked" } as const`. Inside one transaction:
  1. `lockLoginEmail`.
  2. `failures = countRecentLoginFailures(email, now − window)`.
  3. `findUserByEmail`.
  4. `failures >= 5` → `verifyPassword(DUMMY_PASSWORD_HASH, pw)` (result ignored) → insert a `locked` row → return failure. **Never** verify against the account hash here.
  5. Verify against the account, or the dummy if there is no user. Wrong → insert an `invalid_credentials` row → return failure.
  6. Create the session.

  Audit rows: `{ action: "LOGIN_FAILED", companyId: user?.companyId ?? null, userId: user?.id ?? null, meta: { email, reason }, createdAt: now }`. Throw `INVALID_CREDENTIALS` only after the transaction commits. T025 and T026 must pass. Commit `feat: audit failed logins and lock an email after 5 failures`.

**Checkpoint**: the "6th login is blocked" done-when item is proven.

---

## Phase 5: User Story 4 - Visitors without a session are kept out (Priority: P1)

**Goal**: Pages without a session go to `/login`; API routes return an identical 401.

**Independent Test**: `GET /api/auth/me` with no cookie, a random token and an expired session → identical 401; `/` without a session → `/login` (quickstart §1–2).

### Tests for User Story 4 (write first; they must FAIL before T033)

- [x] T031 [P] [US4] Create `tests/integration/server/auth/session-gate.test.ts` for `GET /api/auth/me`:
  - a valid session from `makeSession(userId, now + 1 day)` → 200 `{ data: { name, role, companyName } }`;
  - no cookie, `aqar_session=<random 43 chars>`, `aqar_session=` (empty), and an expired session from `makeSession(userId, now − 1 s)` → each 401, with bodies `toEqual` each other (`UNAUTHORIZED`, "يجب تسجيل الدخول أولاً") and no `data`;
  - tenant (constitution I): users in companies A and B, each with a session. `me` with A's token returns A's company name and never B's, and the same for B.
- [x] T032 [P] [US4] Add a case to `tests/unit/architecture/conventions.test.ts`: every `page.tsx` under `src/app/` except `src/app/login/page.tsx` contains `requireUser(`, and `src/app/login/page.tsx` contains `getCurrentUser(`. It must fail if a new page forgets the check.

### Implementation for User Story 4

- [x] T033 [US4] Add `me(user: SessionUser): ShellUser` (via `toShellUser`) to `auth.service.ts`, and `meHandler = handleRoute({ auth: "user", handler: (req, ctx, user) => ({ data: me(user) }) })` to `auth.routes.ts`. Create `src/app/api/auth/me/route.ts` that re-exports it as `GET`. T031 and T032 must pass. Commit `feat: add current-user endpoint behind the session gate`.

**Checkpoint**: the session gate is proven for API routes and enforced for pages.

---

## Phase 6: User Story 3 - Logout ends the session on the server (Priority: P1)

**Goal**: Logout deletes the session row and clears the cookie; the old token is useless everywhere.

**Independent Test**: log in, keep the raw token, log out, replay the token on `GET /api/auth/me` → 401 (quickstart §1).

### Tests for User Story 3 (write first; they must FAIL before T035)

- [x] T034 [P] [US3] Create `tests/integration/features/auth/logout.test.ts`:
  1. Replay:
     - log in through the real login handler and take the raw token from `Set-Cookie`;
     - `me` with it → 200;
     - logout with it → 200 `{ data: { ok: true } }`, and `Set-Cookie` has `aqar_session=;` and `Max-Age=0`;
     - the session row no longer exists;
     - `me` with the **same raw token** → 401 `UNAUTHORIZED`.
  2. Two sessions of one user; logout of one → the other still gets 200 on `me`.
  3. Logout with no cookie → 200 + cleared cookie.
  4. Logout with a random token → 200, and no other session is deleted (count unchanged).

### Implementation for User Story 3

- [x] T035 [US3] Add `logout(token: string | null)` to `auth.service.ts`: if there is a token, `deleteSession(hashSessionToken(token))`. Add `logoutHandler = handleRoute({ auth: "public", … })` to `auth.routes.ts`: read the token with `readSessionToken(req.headers.get("cookie"))`, call `logout`, and return `{ data: { ok: true } }` with `Set-Cookie: buildClearedSessionCookie()`. Create `src/app/api/auth/logout/route.ts` that re-exports it as `POST`. T034 must pass.
- [x] T036 [US3] Create `src/shared/components/logout-button/` (`logout-button.tsx`, `use-logout-button.ts`, `index.ts`):
  - `useMutation` → `fetch("/api/auth/logout", { method: "POST" })`;
  - on success, `getQueryClient().clear()`, `router.replace("/login")`, `router.refresh()`;
  - on failure, `toast.error("تعذر تسجيل الخروج، حاول مرة أخرى")`;
  - the button "تسجيل الخروج" is disabled while pending.

  Render it in `src/app/(app)/layout.tsx` for now; US6 moves it into the shell header. Commit `feat: add logout that deletes the server session`.

**Checkpoint**: the "logout makes the old token unusable" done-when item is proven.

---

## Phase 7: User Story 5 - Requests from other sites cannot change data (Priority: P1)

**Goal**: Prove that the existing phase 0 origin check (research R8) protects login and logout.

**Independent Test**: a POST with a foreign `Origin` → 403 and nothing changes; the same POST with `APP_ORIGIN` succeeds (quickstart §1, §3).

- [x] T037 [US5] Create `tests/integration/features/auth/origin.test.ts`:
  1. Login with `Origin: https://evil.test` and correct credentials → 403 `INVALID_ORIGIN`, no `Set-Cookie`, no new session, no new audit row.
  2. Login with no `Origin` (`origin: null`) → 403, same checks.
  3. Login with `Origin: http://localhost:3000.evil.test` and with `http://localhost:3001` → 403 (exact match, no prefix match).
  4. Control: the same login with `Origin: http://localhost:3000` → 200.
  5. Logout with a valid session and a foreign `Origin` → 403, and `me` with that session still → 200.
  6. Control: logout with the own origin → 200, then `me` → 401.
  7. `GET /api/auth/me` with a foreign `Origin` and a valid session → 200 (GET is not origin-checked; the session check still applies).

  No source change is expected. If a case fails, fix `src/server/http/route-handler.ts` and say so in the commit. Commit `test: prove cross-site requests to login and logout are refused`.

**Checkpoint**: all three "done when" items are proven.

---

## Phase 8: User Story 6 - Arabic, responsive, role-aware app shell (Priority: P2)

**Goal**: Every logged-in page sits in one RTL shell with the user's name, role and company, logout, and a role-filtered navigation that folds into a menu on phones.

**Independent Test**: at 375 px and 1280 px, as a manager, a sales rep and an accountant: RTL, no horizontal scroll, the menu works by touch and keyboard, and only allowed items show (quickstart §4).

- [x] T038 [P] [US6] Write `tests/unit/shared/lib/navigation.test.ts` first, then `src/shared/lib/navigation.ts`:
  - `NAV_ITEMS: { href, label, roles }[]` with only `{ href: "/", label: "الرئيسية", roles: all }` in this phase;
  - the full map from contracts/ui-shell.md "Navigation map" goes in a comment for later phases;
  - `navItemsFor(role)`.

  Tests: every role gets Home; `navItemsFor` filters by role. Use a test-local item list with a manager-only item to prove the filter excludes it for SALES and ACCOUNTANT.
- [x] T039 [US6] Create `src/shared/components/app-shell/`:
  - `app-shell.tsx` (`"use client"`): reads `useCurrentUser()`.
    - Header: "عقار لايت", the company name, the user name + `ROLE_LABELS[role]`, and `<LogoutButton />`.
    - At `md` and up, a sidebar on the start side with the nav.
    - Below `md`, a menu button (`aria-label="القائمة"`) that opens a shadcn `Sheet` with `side="right"` (the start side in RTL) holding the same nav. Choosing an item closes the sheet; Escape closes it and focus returns (Radix).
    - `<main>` for children.
  - `components/nav-menu/` (`nav-menu.tsx`, `index.ts`): renders `navItemsFor(role)` as `next/link`s, with `aria-current="page"` on the current path (`usePathname`) and an optional `onNavigate` callback.
  - `use-app-shell.ts`: only the sheet open state.
  - `index.ts`.

  Logical classes only. No horizontal scroll from 360 px.
- [x] T040 [US6] Change `src/app/(app)/layout.tsx` to `<CurrentUserProvider user={…}><AppShell>{children}</AppShell></CurrentUserProvider>`, and remove the temporary logout button render from T036. `npm run build` must pass.
- [x] T041 [US6] Manual check per quickstart §4: DevTools at 375 px and 1280 px, logged in as `manager@ufuq.test`, `sales1@ufuq.test` and `accountant@ufuq.test`. Check RTL, no horizontal scroll, Home is the only item, and the menu opens and closes by click, Enter/Space and Escape. Check that the login page fits at 375 px, and that no page shows a sign-up, "forgot password" or user-management link (FR-002). Fix what fails. Commit `feat: add responsive RTL app shell with role-filtered navigation`.

**Checkpoint**: all user stories are complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T042 Update `README.md`:
  - Assumptions: remove "There is no login yet…" and "Until sessions exist (phase 2)…"; add "Sessions last a fixed 7 days; logout ends only the current device".
  - Security: add the phase 2 controls (Argon2id, DB sessions storing only the token hash, the cookie attributes, the generic login message, equal hashing work, the per-email lock) next to the existing lock limits.
  - Running: under the seed accounts, add "Open http://localhost:3000 (not 127.0.0.1: the origin check compares with `APP_ORIGIN`)".
  - Technical decisions: add a short line for the per-email advisory lock and for `GET /api/auth/me`.
- [ ] T043 Run quickstart §2, §3, §5 and §6 on `docker compose up` from a clean state (`docker compose down -v` first).
  - Record which browsers keep the `Secure` cookie on `http://localhost` in README "Running".
  - **If Safari (or any tested browser) refuses it, STOP and ask the user before changing the cookie** (research R2).
  - Record the timing result (SC-005) in the commit message.
  - Record the page gate checks in the commit message (FR-020, FR-022, SC-007; automated only by the optional Playwright test, brief 3.8): `/` with no cookie → `/login`; `/` after logout with the old cookie value pasted back in DevTools → `/login`; `/login` while logged in → `/`.
- [x] T044 Security self-check:
  - `grep -rn "console\." src/` → none;
  - `grep -rn "passwordHash" src/` → only the auth repository/service and `password.ts`;
  - no `localStorage`/`sessionStorage` in `src/`;
  - `npm audit --audit-level=high` clean;
  - every `src/app/api/**/route.ts` only re-exports from a `*.routes.ts`.
- [ ] T045 Final gate: `npm run lint && npm run typecheck && npm run test && npm run test:integration && npm run build` all pass. Then run `/security-review` and fix every open issue. Mark the tasks done in this file, and update `specs/003-auth-app-shell/checklists/requirements.md` if anything changed.
- [ ] T046 Run the `interview-notes` skill for this phase (private notes and README points). Commit `docs: record phase 2 notes`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T002)**: no dependencies. T001 is a hard stop if the baseline fails.
- **Foundational (T003–T012)**:
  - needs Setup;
  - T003, T004, T005, T006 and T011 are [P];
  - T007 → T008 → T009 → T010 (each uses the previous one);
  - T012 is the gate.
- **US1 (T013–T023)**: needs Foundational.
- **US2 (T024–T030)**: needs US1 (it extends `login()` and `login.test.ts`).
- **US4 (T031–T033)**: needs Foundational and `auth.routes.ts` from US1.
- **US3 (T034–T036)**: needs US1 (real login) and US4 (`me` for the replay).
- **US5 (T037)**: needs US1 and US3 (login and logout routes) and US4 (`me`).
- **US6 (T038–T041)**: needs US1 (layout, current-user context) and US3 (logout button).
- **Polish (T042–T046)**: needs all stories.

### User Story Dependencies

- **US1** is the MVP and depends only on Phase 2.
- **US2** builds on US1's `login()`.
- **US4** needs one route file from US1.
- **US3** and **US5** reuse the login and `me` routes to prove their rules end to end.
- **US6** only wraps what exists.
- **Shared files** (edit in order, never in parallel): `auth.service.ts` and `auth.routes.ts` (US1 → US2 → US4 → US3); `login.test.ts` (US1 → US2); `src/app/(app)/layout.tsx` (US1 → US3 → US6).

### Within Each Story

- Tests first; run them and see them fail; then implement until they pass.
- Repository → service → route → page/component.
- Commit after each working step.

### Parallel Opportunities

- Phase 2: T003, T004, T005, T006 and T011 (different files).
- US1: T013 and T014 (tests), then T019 (shared components) alongside T015–T018.
- US2: T024 alongside T025/T026; T028 alongside T029.
- US4: T031 and T032.
- US6: T038 alongside the US3 logout work.

---

## Parallel Example: Phase 2

```text
Task: "T003 [P] INVALID_CREDENTIALS in src/server/http/error-codes.ts + src/shared/lib/error-messages.ts"
Task: "T004 [P] src/shared/lib/roles.ts + tests/unit/shared/lib/roles.test.ts"
Task: "T005 [P] src/server/auth/session-token.ts + tests/unit/server/auth/session-token.test.ts"
Task: "T006 [P] src/server/auth/password.ts + tests/unit/server/auth/password.test.ts"
Task: "T011 [P] tests/integration/support/{db-fixtures,http,audit}.ts"
```

## Parallel Example: User Story 2

```text
Task: "T024 [P] [US2] reason CHECK cases in tests/integration/prisma/schema-constraints.test.ts"
Task: "T028 [P] [US2] src/server/audit/audit.repository.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (sessions resolve; `user` routes really check them; all old tests green).
2. Phase 3 (US1). **STOP and validate**: each seed account logs in and sees its own welcome.

### Incremental Delivery

1. US2: failed logins are audited and locked. Done-when item 2.
2. US4: the API and page gate is proven.
3. US3: logout kills the server session. Done-when item 1.
4. US5: cross-site POSTs are refused. Done-when item 3.
5. US6: the responsive role-aware shell.
6. Polish: README, a clean `docker compose up`, the browser cookie check, the security review and the notes.
