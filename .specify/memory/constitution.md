<!--
Sync Impact Report (1.1.0, 2026-11-12)
- Version change: 1.0.0 → 1.1.0 (MINOR: guidance added; no protection of tenant data removed)
- Modified principles:
  I. Tenant Isolation: added the pre-login lookup exception (user by email, session by token hash,
     failed-login count by email), which cannot take companyId because they establish the tenant
  II. Server-Side Authorization: login, logout and "who am I" act only on the request's own
     credentials or session, so they have no role check
- Reason: found by /speckit.analyze on 003-auth-app-shell; login (brief 3.1) has no company field,
  so the rules as written could not hold for authentication itself
- Templates: no change needed
- AGENTS.md: §3 updated with the same exception
- Deferred TODOs: none

Sync Impact Report (1.0.0)
- Version change: template (unratified) → 1.0.0 (initial ratification)
- Modified principles: none (first version; all placeholders replaced)
- Added principles:
  I. Tenant Isolation (NON-NEGOTIABLE)
  II. Server-Side Authorization
  III. Financial Accuracy
  IV. Atomic and Concurrency-Safe Operations
  V. Database-Enforced Integrity
  VI. Layered Feature Architecture
  VII. Security by Default
  VIII. Scope Discipline and Simplicity
- Added sections: Technical Constraints, Development Workflow, Governance
- Removed sections: none
- Templates and guidance:
  ✅ .specify/templates/plan-template.md — Constitution Check now lists principles I–VIII as gates
  ✅ .specify/templates/tasks-template.md — tests are required where the constitution or
     AGENTS.md §8 requires them (no longer "OPTIONAL")
  ✅ .specify/templates/spec-template.md — no principle references; no change needed
  ✅ .specify/templates/checklist-template.md — no principle references; no change needed
  ✅ .claude/skills/speckit-*/SKILL.md — reference .specify/memory/constitution.md generically;
     no change needed
  N/A .specify/templates/commands/ — directory does not exist
  ✅ AGENTS.md — checked; agrees with every principle (it is stricter in places, e.g. no
     Server Actions). No edit made.
  ⚠ README.md — does not exist yet. Principle VIII requires an "Assumptions" section; create it
     in a later phase.
- Deferred TODOs: none
-->

# Aqar Lite Constitution

<!--
Non-negotiable principles for every spec, plan and task. /speckit.plan and /speckit.analyze check against them.
Each rule must be checkable. The "how" details live in AGENTS.md; this file says what must always be true.
Order of authority: docs/brief.md > this constitution > AGENTS.md > spec/plan/tasks.
-->

## Core Principles

### I. Tenant Isolation (NON-NEGOTIABLE)

- A user can never read or change data of another company, through any page, API route or query parameter.
- The company and the user are taken from the server session only, never from the request.
- Every data access function requires `companyId` and filters by it.
- Exception, before the tenant is known: the three lookups that establish who the user is (user by login email,
  session by token hash, recent failed logins by email) cannot take `companyId`. They return only the caller's own
  user or session, and every function after them takes `companyId` from that session.
- A record from another company returns 404.
- Every feature that reads or writes tenant data has an integration test that proves cross-company access is refused.

**Rationale:** the brief says no company may see another company's data under any condition.
One leak fails the test.

### II. Server-Side Authorization

- Every API route and every service function checks the role AND the ownership before it acts.
- Login, logout and "who am I" have no role check: they act only on the credentials or the session sent with the
  request, never on another user's data.
- The UI may hide actions, but hiding is never the check.
- Input schemas list the allowed fields (allowlist). A user cannot change a field he is not allowed to change, even if he sends it by hand.

**Rationale:** the attacker is a logged-in user; permissions are enforced on every request.

### III. Financial Accuracy

- Money is integer halalas everywhere: database, code and JSON. No floating point.
- The down payment plus all installments equal the final price exactly.
- Dates for due dates and "overdue" use the `Asia/Riyadh` time zone.
- Derived states (installment status, remaining amount) are computed from stored facts, never stored separately.
- Schedule generation and payment allocation have unit tests for edge cases (31 January, rounding, partial and multi-installment payments).

**Rationale:** financial accuracy is judged as part of the work, not as an extra.

### IV. Atomic and Concurrency-Safe Operations

- Contract approval and payment recording each run in one database transaction.
- Two concurrent reservations of one unit: exactly one succeeds; the other gets a clear 409 message. A test proves it with real parallel requests.
- A repeated payment request with the same idempotency key never creates a second payment.
- Unit status changes only through the allowed transitions: available → reserved → sold, and reserved → available on expiry.

**Rationale:** the brief tests real concurrent requests and network retries.

### V. Database-Enforced Integrity

- Every schema change is a migration. Applied migrations are never edited.
- Integrity rules live in the database too: foreign keys, unique, check constraints.
- Payments and audit log rows can never be updated or deleted (enforced by database triggers).

**Rationale:** code can have bugs; the database is the last line of defense.

### VI. Layered Feature Architecture

- Request flow is route → service → repository. Business rules live only in services and pure `domain/` functions, never in React components or route handlers.
- Only repositories touch the ORM. Services own transactions.
- Features depend in one direction only (payments → contracts → reservations → units, clients), through each feature's public `server/index.ts`. No cycles.
- TypeScript strict mode, no `any`.

**Rationale:** the brief requires separated layers, and the code must be easy for a colleague to continue.

### VII. Security by Default

- Passwords: Argon2id. Sessions: server-side, revocable, in an `HttpOnly`, `Secure`, `SameSite` cookie. No tokens in browser storage.
- Login errors never reveal whether an email exists. Repeated failed logins are throttled.
- Every input is validated on the server with Zod, including filter, sort and pagination parameters.
- No SQL built by joining strings. User text is rendered as text, never as HTML.
- Errors shown to users are generic; details go only to server logs. Secrets, passwords and tokens never appear in logs, responses, the repository or frontend code.
- The audit log records: failed logins, price changes, contract approvals, payments.

**Rationale:** the system must be safe to put on the internet tomorrow.

### VIII. Scope Discipline and Simplicity

- Build only what the brief asks. Out of scope: dashboard, export, file upload, contract cancellation, CRM stages, user management, password reset.
- "Extra" items start only after all required items are complete and tested.
- No new dependency without a clear reason written in the plan.
- When a business rule is unclear, ask, decide, and record the decision in the README "Assumptions" section.

**Rationale:** fewer features built well beat a complete but fragile system.

## Technical Constraints

- Next.js App Router + TypeScript strict; API through Route Handlers under `/api`; TanStack Query on the client with server-side prefetch.
- PostgreSQL + Prisma, with migrations and seed.
- The whole system starts on a clean machine with `git clone` then `docker compose up`.
- Arabic RTL UI that works on mobile and desktop, with loading, empty and error states.
- `npm audit` shows no high or critical vulnerabilities. Basic HTTP security headers are set.

## Development Workflow

- One spec per phase, in order. A phase starts only when the previous phase is merged and its tests pass.
- Per phase: `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`.
- Every plan has a Constitution Check that lists each principle above as PASS or explains the exception.
- Commit after each completed task with a small Conventional Commit. Never one big commit.
- A phase is done when `npm run lint`, `npm run typecheck`, `npm run test` and the phase's integration tests pass, and `/security-review` shows no open issues.

## Governance

- This constitution overrides AGENTS.md, specs, plans and tasks. Only `docs/brief.md` overrides it.
- Any change needs a reason, an updated version number, and a check that AGENTS.md still agrees with it.
- Versioning: MAJOR when a principle is removed or changed in meaning, MINOR when one is added, PATCH for wording.

**Version**: 1.1.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-12
