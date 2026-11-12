# Research: Login, Logout and App Shell

**Feature**: `003-auth-app-shell` | **Date**: 2026-11-12

Versions are the phase 0 pins: Next.js 16.4.6, React 19.3.1, TypeScript 6.0.3, Prisma 7.10.1 +
`@prisma/adapter-pg`, `@node-rs/argon2` 2.2.2, Zod 4.6.7, TanStack Query 5.107.1, React Hook Form 7.92.0,
Vitest 5.1. Results marked **Observed** were checked in this worktree on 2026-11-12.

## R1. Where the auth code lives

- **Decision**: split auth into infrastructure and one feature.
  - `src/server/auth/` (infrastructure that every feature uses, AGENTS.md §2): session token and cookie helpers,
    password hashing, `session.repository.ts`, `session.service.ts` (`getSessionUser`), and the two entry points
    `requireUser()` (pages) and `getRequestUser(req)` (route wrapper).
  - `src/server/audit/` (infrastructure): `audit.repository.ts` with `insertAuditLog` and
    `countRecentLoginFailures`.
  - `src/features/auth/` (the login feature): `auth.schemas.ts`, `auth.types.ts`, `server/auth.routes.ts`,
    `server/auth.service.ts`, `server/auth.repository.ts`, `client/login-form/`.
  - The app shell and home welcome are cross-feature UI, so they live in `src/shared/components/`. They call no
    feature code: the logout button posts to `/api/auth/logout` directly.
- **Rationale**: every later feature needs `requireUser()` and the route wrapper. If they lived in
  `features/auth`, every feature would depend on it, and the route wrapper in `src/server/http` would import a
  feature. AGENTS.md already puts "auth" and "audit" in `src/server/`.
- **Alternatives considered**: everything under `features/auth` (rejected: `src/server/http` → feature
  import). The shell under `features/auth/client` (rejected: every page layout would import a feature's client
  code).

## R2. Session token, hash and cookie

- **Decision**:
  - Token = `randomBytes(32)` as base64url (43 chars). Session id = `sha256(token)` as lowercase hex (64 chars),
    which satisfies the phase 1 CHECK on `sessions.id`.
  - Cookie `aqar_session` = token; `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
    Logout sends the same cookie with `Max-Age=0`.
  - Expiry = login time + 7 days, stored in `sessions.expires_at`; never extended (spec FR-012).
  - Route handlers read the cookie from the `Cookie` request header and set it with a `Set-Cookie` response
    header. Pages read it with `cookies()` from `next/headers`.
- **Rationale**: building the headers by hand keeps route handlers plain `(Request) => Response`, so integration
  tests call them directly with a `Request` and read `Set-Cookie`, with no Next.js request context.
  `cookies()` in a route handler would throw outside Next.js.
- **Alternatives considered**: a `__Host-` cookie prefix (rejected: extra risk on `http://localhost` in some
  browsers, for no gain on a single-origin app). Sliding expiry (rejected in the spec).
- **Open risk**: browsers treat `http://localhost` as a secure context, so the `Secure` cookie is stored there in
  Chrome and Firefox. Safari support is not confirmed. quickstart.md has a manual Safari check, and the result
  goes into the README. If Safari refuses the cookie, the user decides before shipping; nothing is quietly
  changed.

## R3. Password check and equal timing

- **Decision**:
  - `verifyPassword(hash, password)` wraps `@node-rs/argon2` `verify` and returns `false` when it throws.
  - `DUMMY_PASSWORD_HASH` is a **hard-coded constant** made with the same default `hash()` parameters as the seed
    (`$argon2id$v=19$m=19456,t=2,p=1$…`). An unknown email and a locked email both run
    `verifyPassword(DUMMY_PASSWORD_HASH, password)`; the result is ignored.
- **Observed**:
  - `hash("x")` with defaults → `$argon2id$v=19$m=19456,t=2,p=1$…` in ~71 ms; `verify` ~74 ms.
  - `verify("fixture-password-hash", "x")` **throws** `Decoding failed`. Without the wrapper, an account with a
    broken hash would return 500 instead of the generic 401: a different response.
- **Rationale**: a hash computed lazily on the first request would make that first unknown-email login pay
  hash + verify, a one-time timing tell. A constant costs nothing.
- **Alternatives considered**: skip hashing for unknown or locked emails (rejected: reveals existence by
  timing, spec FR-007).

## R4. Lock count, concurrency and the audit write

- **Decision**: `login()` runs in one transaction:
  1. `pg_advisory_xact_lock(hashtextextended(email, 0))`, which serializes attempts for **one** email only. It is
     sent as a tagged template (`$executeRaw`), never string-built. The function returns `void`, so `$queryRaw`
     would have to read a value it cannot decode.
  2. Count `LOGIN_FAILED` rows with `meta->>'reason' = 'invalid_credentials'` for this email since
     `now − 15 min`.
  3. Find the user by email.
  4. Count ≥ 5 → dummy verify, insert a `locked` row, return `{ ok: false }`.
  5. Otherwise verify (or dummy verify if there is no user). Wrong → insert an `invalid_credentials` row, return
     `{ ok: false }`.
  6. Right → create the session, return `{ ok: true, token }`.

  The service throws `AppError("INVALID_CREDENTIALS")` **after** the transaction commits. Throwing inside it
  would roll back the audit row.
- **Rationale**: without the lock, 10 parallel wrong attempts all read "4 failures" and all get a guess, so the
  limit becomes "5 + parallelism". The advisory lock is per email, so other users never wait. It holds one
  pooled connection for about one argon2 verify (~75 ms).
- **Transaction limits**: Prisma's interactive transaction defaults are `maxWait` 2 s and `timeout` 5 s. The
  parallel test uses 8 attempts, so the last one waits about 8 × 75 ms ≈ 0.6 s inside its transaction, well below
  5 s. `withTransaction` stays unchanged.
- **Alternatives considered**: `SELECT … FOR UPDATE` on the user row (rejected: an unknown email has no row,
  and the lock must also hold for it). A unique "attempt slot" table (rejected: a new table for one rule).

## R5. Count query uses the phase 1 index

- **Decision**: `countRecentLoginFailures` is a raw tagged-template query (`$queryRaw`), never string-built:
  `SELECT count(*) FROM audit_logs WHERE action = 'LOGIN_FAILED' AND meta->>'email' = ${email} AND
  meta->>'reason' = 'invalid_credentials' AND created_at > ${since}`.
- **Rationale**: the phase 1 index is `((meta->>'email'), created_at) WHERE action = 'LOGIN_FAILED'`. Prisma's
  JSON `path` filter compiles to a different expression, which this index does not serve. The expression must
  match the index exactly. Tagged templates send values as parameters, so there is no SQL injection
  (constitution VII).

## R6. One clock for the window

- **Decision**: the service reads the time once with `new Date()` and uses it for both the window start and
  `createdAt` of the audit row it writes. Session `expires_at` uses the same value + 7 days.
  - Tests that need time to pass fake **only** `Date` (`vi.useFakeTimers({ toFake: ["Date"] })` +
    `vi.setSystemTime`). They also insert old failures with explicit `createdAt` through a fixture whose
    `meta.email` is already normalized (the phase 1 CHECK requires it).
- **Rationale**: the DB default `now()` and the app clock can differ, for example Docker on macOS. Mixing them in
  one comparison makes the lock tests flaky. One source of time makes the window exact and testable.

## R7. Database guard for the reason value

- **Decision**: add one migration, `login_failed_reason_check`:
  `CHECK (action <> 'LOGIN_FAILED' OR meta->>'reason' IN ('invalid_credentials', 'locked'))` on `audit_logs`.
- **Rationale**: the reason now decides the lock. A typo such as `"invalid_credential"` in code would mean
  unlimited guesses with no error. Constitution V: integrity rules also go in the database. No row exists yet that
  breaks it: the seed writes no audit rows.
- **Alternatives considered**: code-only constant (rejected for the reason above). An enum column for reason
  (rejected: the column only applies to one action; JSON + CHECK matches the phase 1 email rule).

## R8. Origin check (already built)

- **Observed**: `handleRoute` (`src/server/http/route-handler.ts:42`) refuses POST, PUT, PATCH and DELETE when
  `Origin !== APP_ORIGIN`, which includes a missing header, before any auth work, with `INVALID_ORIGIN` (403).
  This matches spec FR-023.
- **Decision**: keep the check, and let `APP_ORIGIN` hold a comma-separated list matched entry by entry (exact
  string equality). The shipped value allows `http://localhost:3000` and `http://127.0.0.1:3000`, because the
  clean-clone check showed login refused on `127.0.0.1`. This phase adds the integration tests the spec requires,
  through the real login and logout routes.

## R9. Route wrapper and the session gate

- **Decision**: `handleRoute({ auth: "user", handler })` resolves the user with `getRequestUser(req)` (cookie →
  hash → session joined to user and company, `expires_at > now`) and passes it to the handler as a third
  argument. No user → `UNAUTHORIZED` (401, the existing message "يجب تسجيل الدخول أولاً"). `auth: "public"` is
  unchanged. Login and logout are `public`. Logout reads the cookie itself, so it also works with no session.
- **Tests**: `tests/unit/server/http/route-handler.test.ts` currently expects `user` routes to always give 401.
  It is updated to mock `getRequestUser`.
- **Spec alignment**: the spec's 401 text is updated to the existing `UNAUTHORIZED` message ("يجب تسجيل الدخول
  أولاً").

## R10. A protected route for the tests: `GET /api/auth/me`

- **Decision**: add `GET /api/auth/me` (`auth: "user"`) returning `{ name, role, companyName }`.
- **Rationale**: the logout, expiry and random-token tests need a real protected API route, and later phases have
  none yet. It is also a small, real endpoint. The shell does not need it, because the layout gets the user on the
  server.

## R11. Pages: `requireUser()` and the login page

- **Decision**:
  - `requireUser()` (wrapped in React `cache()` so one request looks up the session once) reads the cookie and
    calls `redirect("/login")` when there is no valid user.
  - `src/app/(app)/layout.tsx` calls it and renders the shell. Every `page.tsx` inside `(app)` also calls it,
    because a layout does not re-run on every client navigation (AGENTS.md §7).
  - `src/app/login/page.tsx` calls `getCurrentUser()` (no redirect) and redirects to `/` when a user exists.
  - No `middleware`/`proxy` (AGENTS.md §7).
- **Exception**: the login page cannot call `requireUser()`. This is recorded in the plan's Constitution Check.

## R12. Client login and logout flow

- **Decision**:
  - The login form uses React Hook Form + `zodResolver(loginSchema)`, the same schema as the API, and
    `useMutation` → `POST /api/auth/login`. The browser sends `Origin` itself.
    - On success: `queryClient.clear()`, `router.replace("/")`, `router.refresh()`.
    - 400 → `setError` on each field.
    - Error code `INVALID_CREDENTIALS` → the generic message at the top of the form.
    - Anything else → the generic server-error message at the top. The client branches on `error.code`, not on the
      status.
  - The logout button: `useMutation` → `POST /api/auth/logout`, then `queryClient.clear()` and
    `router.replace("/login")` + `router.refresh()`. A failed logout shows a `sonner` toast.
- **Rationale**: clearing the query cache stops the next user on a shared browser from seeing cached data from
  later phases. No Server Actions (AGENTS.md Section B).

## R13. UI primitives and the dependency gate

- **Observed**: `components.json` uses the shadcn `radix-nova` style, whose components import from the
  `radix-ui` package. `radix-ui` is **not** in `package.json`; the `@radix-ui/*` folders in `node_modules` are
  transitive and must not be imported. `src/shared/components/ui/` is empty.
- **Decision (approved by the user 2026-11-12)**: add `radix-ui`, pinned to an exact version, and generate the
  shadcn `button`, `input`, `label`, `card` and `sheet` (mobile menu) into `src/shared/components/ui/`.
- **Rationale**: shadcn/ui is the project's chosen UI kit (AGENTS.md Section B), and `radix-nova` needs this
  package. Later phases need `dialog`, `select` and `dropdown-menu` from it too. Radix gives the mobile menu
  focus trapping, Escape to close and focus return without hand-written code.
- **Alternatives considered**: hand-written primitives and menu with no new package (rejected by the user:
  more code to own and test for the same result).

## R14. Navigation map

- **Decision**: `src/shared/lib/navigation.ts` holds `NAV_ITEMS: { href, label, roles }[]` with only the sections
  whose pages exist; in this phase that is Home only. The full map from spec FR-024 is a comment beside it for
  later phases. `navItemsFor(role)` filters by role. Role values and Arabic labels live in
  `src/shared/lib/roles.ts` (`MANAGER` → مدير, `SALES` → مندوب مبيعات, `ACCOUNTANT` → محاسب), so client code
  never imports the generated Prisma enum.
- **Current user on the client**: the `(app)` layout wraps the shell in `CurrentUserProvider`, a small React context
  holding `ShellUser`, as agreed in docs/phases.md. Client components read it with `useCurrentUser()`. It is only for
  display and nav filtering.
- **Rationale**: no link to a missing page (spec FR-024). The map is UI convenience only; the server checks stay
  (FR-025).

## R15. Agent context script

- **Observed**: `.specify/scripts/bash/` has no agent-context update script (integration `codex`). Phase 1 did
  not change AGENTS.md either.
- **Decision**: not run. `CLAUDE.md` stays `@AGENTS.md`.
