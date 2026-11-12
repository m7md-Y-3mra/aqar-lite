# Implementation Plan: Login, Logout and App Shell

**Branch**: `claude/login-logout-app-shell-62f633` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-auth-app-shell/spec.md`

## Summary

Add hand-written, database-backed sessions:
- A 32-byte random token in an `HttpOnly; Secure; SameSite=Lax` cookie, with only its SHA-256 stored, and a fixed
  7-day expiry.
- `POST /api/auth/login`, `POST /api/auth/logout` and `GET /api/auth/me`.
- `requireUser()` for pages, and real session resolution in the existing route wrapper.

Login runs in one transaction under a per-email advisory lock:
- It counts recent `invalid_credentials` rows through the phase 1 index.
- It runs one Argon2id verify on every path; unknown and locked emails use a constant dummy hash.
- It writes a `LOGIN_FAILED` audit row with a reason, and throws only after commit.

One new migration adds a CHECK on that reason. The UI adds:
- an Arabic RTL login page;
- a responsive app shell with a role-filtered navigation (Home only for now) and logout;
- a welcome home page.

Integration tests prove the three "done when" items in ways that can fail: logout token replay, the 6th login with
the correct password, and foreign/missing vs own `Origin`.

## Decision needed before implement

**UI primitives (research R13)**: the shadcn `radix-nova` style needs the `radix-ui` package, which is not
installed. AGENTS.md §9 says to ask before adding a package.
- **A (recommended)**: add `radix-ui` and generate `button`, `input`, `label`, `card` and `sheet`.
- **B**: no new package; hand-write those in the shadcn style.

Only `src/shared/components/ui/` and the shell's mobile menu differ.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict, no `any`), Node.js 22 LTS

**Primary Dependencies**: Next.js 16.4.6 (App Router, Route Handlers), React 19.3.1, Prisma 7.10.1 +
`@prisma/adapter-pg`, `@node-rs/argon2` 2.2.2, Zod 4.6.7, TanStack Query 5.107.1, React Hook Form 7.92.0 +
`@hookform/resolvers`, `sonner`, pino. **New dependency: only `radix-ui` if option A is approved.**

**Storage**: PostgreSQL 18. Tables `users`, `companies`, `sessions` and `audit_logs` from phase 1; one new CHECK
migration.

**Testing**: Vitest 5.1. Unit (`tests/unit`, no DB) and integration (`tests/integration`, real `aqar_test`
database, `fileParallelism: false`). Route handlers are called directly with `Request` objects. Time-dependent
tests fake only `Date`.

**Target Platform**: Linux containers (Docker Compose); browsers at `http://localhost:3000`.

**Project Type**: Web application (one Next.js project).

**Performance Goals**: login ≈ one Argon2id verify (~75 ms observed) + 3–4 small queries. The session check is one
indexed primary-key lookup per request, deduplicated per request with React `cache()` on pages.

**Constraints**: no auth library, no middleware/proxy, no Server Actions, no tokens in browser storage, no
`console.log` in server code, logical RTL classes only.

**Scale/Scope**: 3 API routes, 2 pages (login and home) + 1 layout, 8 seed accounts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Source: `.specify/memory/constitution.md`.

| # | Principle | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| I | Tenant Isolation (NON-NEGOTIABLE) | PASS with justified exception | `companyId` and `role` come only from the session → user row, read fresh on every request (FR-015). **Exception E1**: three functions establish the tenant and cannot take `companyId`: `findUserByEmail`, `findSessionById` and `countRecentLoginFailures` (keyed by email). They return only the caller's own user/session. No tenant data is read in this phase. Every later repository function takes `companyId`. |
| II | Server-Side Authorization | PASS | `handleRoute` resolves the session for every `auth: "user"` route. Every `(app)` page calls `requireUser()`. The navigation map is UI only (FR-025). The login input schema allows only `email` and `password`. |
| III | Financial Accuracy | N/A | No money or dates of money in this phase. |
| IV | Atomic and Concurrency-Safe Operations | PASS | Login is one transaction with a per-email advisory lock, so parallel attempts cannot pass the 5-failure limit (research R4). Proof: the parallel test (8 attempts → exactly 5 + 3). The audit row commits before the error is thrown. |
| V | Database-Enforced Integrity | PASS | New migration `login_failed_reason_check` (research R7). Existing: session id hash shape, normalized emails, append-only audit log. No applied migration is edited. |
| VI | Layered Feature Architecture | PASS | `auth.routes.ts` → `auth.service.ts` → repositories. The service uses `withTransaction` and passes `tx`. Prisma only in `*.repository.ts`; raw SQL only as tagged templates in repositories. The shell is in `src/shared/components` and imports no feature. Every server file starts with `import "server-only"`. |
| VII | Security by Default | PASS with justified exception | Argon2id; `HttpOnly`/`Secure`/`SameSite=Lax` cookie; logout deletes the row; generic login message; equal hashing work; per-email lock; Zod on input; existing Origin check; failed logins audited; pino redaction covers password/token/cookie. **Exception E2**: `/login` cannot call `requireUser()`, because it is the page for users without a session. It calls `getCurrentUser()` and redirects logged-in users. **Accepted risks** (spec clarification Q2): no per-IP limit, victim lockout. Both are in the README. |
| VIII | Scope Discipline and Simplicity | PASS (pending R13) | No sign-up, user management, password reset or dashboard. `GET /api/auth/me` is the only addition beyond the stories; the tests need a protected route (research R10). The new package needs approval. |

**Post-design re-check**: unchanged. E1 and E2 are justified in Complexity Tracking. VIII stays pending until the
user answers R13.

**Agent context**: no agent-context script exists for the `codex` integration (research R15). Not run.

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-app-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-auth.md
│   └── ui-shell.md
├── checklists/requirements.md
└── tasks.md             # next: /speckit-tasks
```

### Source Code (repository root)

```text
prisma/migrations/<timestamp>_login_failed_reason_check/migration.sql   # new (CHECK on meta.reason)

src/server/
├── auth/
│   ├── session-token.ts          # new: generate token, sha256 id, expiry, cookie build/parse/clear
│   ├── password.ts               # new: verifyPassword (catches throw), DUMMY_PASSWORD_HASH constant
│   ├── session.repository.ts     # new: createSession, findSessionById (+ user, company), deleteSession
│   ├── session.service.ts        # new: getSessionUser(token, now)
│   ├── require-user.ts           # new: requireUser() / getCurrentUser() for pages (cookies(), cache())
│   └── request-user.ts           # new: getRequestUser(req) for the route wrapper
├── audit/
│   └── audit.repository.ts       # new: insertAuditLog, countRecentLoginFailures ($queryRaw)
└── http/
    ├── route-handler.ts          # change: auth "user" resolves the session, passes user to handler
    └── error-codes.ts            # change: INVALID_CREDENTIALS 401

src/features/auth/
├── auth.schemas.ts               # new: loginSchema (shared by API and form)
├── auth.types.ts                 # new: ShellUser
├── server/
│   ├── auth.routes.ts            # new: login, logout, me handlers
│   ├── auth.service.ts           # new: login(input, now), logout(token), me(user)
│   └── auth.repository.ts        # new: lockLoginEmail (advisory lock), findUserByEmail
└── client/login-form/
    ├── login-form.tsx            # new
    ├── use-login-form.ts         # new: RHF + useMutation + error mapping
    └── index.ts

src/shared/
├── lib/
│   ├── roles.ts                  # new: ROLES, ROLE_LABELS
│   ├── navigation.ts             # new: NAV_ITEMS (Home), navItemsFor(role)
│   └── error-messages.ts         # change: INVALID_CREDENTIALS message
└── components/
    ├── ui/                       # new: button, input, label, card (+ sheet if option A)
    ├── app-shell/                # new: app-shell.tsx, use-app-shell.ts (menu + logout), types.ts, index.ts
    │   └── components/nav-menu/  # new: nav list used in sidebar and mobile menu
    └── home-welcome/             # new: home-welcome.tsx, index.ts

src/app/
├── (app)/
│   ├── layout.tsx                # new: requireUser() → <AppShell user={…}>
│   └── page.tsx                  # moved from src/app/page.tsx: requireUser() → <HomeWelcome>
├── login/page.tsx                # new: getCurrentUser() → redirect("/") or <LoginForm>
└── api/auth/
    ├── login/route.ts            # new: export { POST } from auth.routes
    ├── logout/route.ts           # new
    └── me/route.ts               # new: export { GET }

tests/
├── unit/
│   ├── server/auth/session-token.test.ts     # token length/charset, id = sha256 hex, cookie attributes
│   ├── server/auth/password.test.ts          # broken hash → false; dummy hash has the default params
│   ├── server/http/route-handler.test.ts     # change: user routes use mocked getRequestUser
│   ├── features/auth/auth.schemas.test.ts    # trim/lowercase, max lengths, extra keys dropped
│   └── shared/lib/navigation.test.ts         # role filter; ROLES match the Prisma enum
└── integration/
    ├── support/db-fixtures.ts                # change: makeUserWithPassword, makeLoginFailure(email, reason, createdAt)
    ├── features/auth/login.test.ts
    ├── features/auth/login-lock.test.ts
    ├── features/auth/logout.test.ts
    ├── features/auth/origin.test.ts
    ├── server/auth/session-gate.test.ts
    └── prisma/schema-constraints.test.ts     # change: reason CHECK case
```

**Structure Decision**: one Next.js project, the existing layout. Auth infrastructure goes in `src/server/auth`
and `src/server/audit` (research R1). The login feature goes in `src/features/auth`, and the cross-feature shell in
`src/shared/components`. The home page moves into the `(app)` route group so it shares the authenticated layout.

### Other files touched

- `README.md`: replace the two phase 0 lines ("no login yet", "API routes … always answer 401"). Add the browser
  cookie result (quickstart §5). Mention `GET /api/auth/me`.
- `specs/003-auth-app-shell/spec.md` (already updated with this plan):
  - FR-021 and Story 4 use the existing 401 text "يجب تسجيل الدخول أولاً".
  - The Dependency note says one CHECK migration is added.
  - FR-021 exempts logout as well as login from the session check (FR-019).

## Key implementation rules (for /speckit-tasks)

1. **Login transaction**:
   - Lock the email → count `invalid_credentials` since `now − 15 min` → find the user → decide → write one
     audit row with `createdAt = now` → commit.
   - Return `{ ok: false }` out of the transaction and throw `INVALID_CREDENTIALS` after it. Never throw inside it.
2. **One clock**: `now` is read once per login and used for the window, `createdAt` and `expires_at`.
3. **Equal work**: every failure path runs exactly one `verifyPassword`. The locked path never verifies against
   the account's hash.
4. **Validation**: invalid input returns 400 before any DB work and writes no audit row.
5. **Never logged or returned**: the password, the token or `passwordHash`.
6. **Tests that can fail**:
   - The 6th attempt uses the correct password.
   - Logout replays the raw token.
   - Origin tests include an accepted same-origin request.
   - The "locked retries don't extend" test makes at least 5 `locked` retries before moving past the window.
   - The parallel test asserts exactly 5 + 3 rows.
7. **Commits**: one Conventional Commit per working step, tests first where the spec requires them.

## Complexity Tracking

| Exception | Why needed | Simpler alternative rejected because |
|---|---|---|
| E1: `findUserByEmail`, `findSessionById` and `countRecentLoginFailures` take no `companyId` | Login has no company field (brief 3.1), and a session token is the thing that tells us the company | Asking for a company at login: not in the brief, and it would reveal which companies exist |
| E2: `/login` page does not call `requireUser()` | It is the one page for visitors without a session | Calling it would redirect every visitor to `/login` forever |
