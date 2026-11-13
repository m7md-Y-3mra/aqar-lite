# Research: Audit Log, Hardening and Delivery

No open technical question remained after `/speckit-clarify`. Each decision below has a rationale and the
alternative that was rejected.

## R1. Where the audit log read code lives

- **Decision**: a new feature folder `src/features/audit-log/`. It has its own `audit-log.repository.ts`, which
  reads `audit_logs` (with the actor's `users.name`). `src/server/audit/audit.repository.ts` stays the
  write side plus the pre-login failure count.
- **Rationale**: the audit log screen is a manager feature with a page, an API route, a query key and client
  components, which is the feature-folder layout (AGENTS.md §2). The write helper in `src/server/audit/` is shared
  infrastructure used by four features ("any feature may use auth and audit"). Putting a manager-only, paged read
  next to it would mix an infrastructure helper with one screen's query.
- **Alternatives rejected**: (a) add `findAuditLogs` to `src/server/audit/audit.repository.ts` and call it from a
  feature service. This works, but a feature then depends on an infrastructure file for its main query, and the
  file gains a second purpose. (b) Put everything in `src/server/audit/` with no feature folder. Rejected because
  `src/server/` may not hold client components, keys or a page DTO.

## R2. Parse the stored details per event type on the server

- **Decision**: `meta` is parsed on the server with one Zod schema per action (`audit-log.schemas.ts`), by a pure
  function `toAuditEvent(row)` in `src/features/audit-log/domain/audit-event.ts`. The DTO is a union keyed by
  `action`. If `meta` does not match its schema, `details` is `null` and the row shows "—". Unknown keys are dropped.
  For `LOGIN_FAILED`, only `email` (at most 254 characters, the login schema's limit) and `reason` are returned.
  No user name or id is returned for failed logins.
- **Rationale**: FR-013 says the raw stored details object must not be exposed unchecked. A typed union lets the
  client render each type without `any`. Dropping the target user's name on failed logins matches the
  clarification: the user column shows the typed email, because the stored account is only the target.
- **Alternatives rejected**: (a) return `meta` as `unknown` and format it in the component. That sends unchecked
  JSON to the browser and puts parsing logic in a React component (brief §5). (b) Add typed columns to
  `audit_logs`. That needs a schema change for a read-only screen, and the existing rows already have `meta`.

## R3. Drift between writers and the reader

- **Decision**: one integration test creates each event through its real writer: `login()` with a wrong
  password, `updateUnit()` with a new price, `approveContract()`, `recordPayment()`. It then calls
  `listAuditLog()` and asserts that every row has non-null `details` with the expected values.
- **Rationale**: the four `meta` schemas only describe what four other services write. Tests that build `meta`
  with fixtures would only prove the reader agrees with itself. If a writer changes a key, this test fails.
- **Alternative rejected**: unit tests with hand-written `meta` only. They are kept for edge cases (bad `meta`,
  long email), but alone they cannot catch drift.

## R4. Order and pages

- **Decision**: `ORDER BY created_at DESC, id DESC`, offset pages using the shared `paginationFields` (default
  20, max 50, page ≥ 1) and `toSkip`. The query schema has only `page` and `pageSize` (no filters, clarified).
  The existing index `audit_logs(company_id, created_at)` serves the filter and the order.
- **Rationale**: same rules as every other list (AGENTS.md, Section B). `id` as the second key makes equal
  `created_at` values stable across pages (FR-006).
- **Alternative rejected**: cursor pages. These are better under constant inserts, but AGENTS.md fixes offset pages,
  and a manager reading the log does not need them.

## R5. Tenant scope and actor name

- **Decision**: the repository filters `WHERE company_id = $companyId` (from the session). Null-company rows never
  match. It selects `user: { name, companyId }`, and the service returns `actorName` only when
  `user.companyId === session.companyId`.
- **Rationale**: FR-002 and FR-003. `audit_logs.user_id` is a single-column foreign key, so the database does not
  guarantee the actor is in the same company. Writers always set both from one session, but this one comparison
  makes the reader safe even if a writer has a bug.
- **Alternative rejected**: a raw SQL join. Prisma `findMany` with `select` is enough and needs no raw SQL.

## R6. Page and navigation gate

- **Decision**: `src/app/(app)/audit-log/page.tsx` calls `requireUser()`, and `redirect("/")` for any role but
  `MANAGER` (same as the reservations page for accountants). The service throws `FORBIDDEN` for any role but
  `MANAGER`, so the API returns 403. The navigation map adds `{ href: "/audit-log", roles: ["MANAGER"] }`.
- **Rationale**: the service is the check (constitution II). The page redirect only avoids a broken screen.
- **Alternative rejected**: a 403 page. No other page in the app does this, and a redirect shows no data either.

## R7. Badge colors

- **Decision**: one `AuditEventBadge` component with a `constants.ts` that maps each action to its Arabic label and
  a Tailwind class set on the existing shadcn `Badge`: failed login → red (destructive), price change → amber,
  contract approval → blue, payment → green. Each badge also has its text label, so the meaning never depends on
  color alone.
- **Alternative rejected**: new `Badge` variants in `src/shared/components/ui/badge.tsx`. Only this screen uses
  them, so a local class map is smaller.

## R8. Dependency audit

- **Decision**: today `npm audit` reports 0 critical, 0 high and 7 moderate findings (all in the
  `@typescript-eslint/*` dev tooling). **Do not run `npm audit fix`**: it would move the TypeScript 6.0 and
  typescript-eslint pins that the README explains. The README lists the moderate findings and the reason.
- **Rationale**: the brief requires no high or critical findings. Dev-only lint tooling does not ship in the image.
- **Alternative rejected**: `npm audit fix --force`. It risks major upgrades that break lint or typecheck for
  findings that are not required.

## R9. Secrets check without a new tool

- **Decision**: no secrets scanner is installed, and adding one needs approval (AGENTS.md §9). Use git and grep:
  1. `git log --all -p | grep -nE` with these patterns: private-key headers, `AKIA[0-9A-Z]{16}`, `ghp_`, `gho_`,
     `sk_live`, `sk-`, `xox[bp]-`, `password\s*[:=]`, and `postgres(ql)?://` URLs whose password is not `aqar` or `ci`.
  2. `git log --all --diff-filter=A --name-only` must list no `.env` file (only `.env.example`).
  3. Every hit is either removed or documented as a local development value (DB user `aqar`/`aqar`, demo password).
- **Alternative rejected**: install gitleaks. It is a better scanner, but it needs approval for a one-time check
  that a grep covers on a small history.

## R10. Clean-clone check

- **Decision**: after the last code commit, stop every other compose stack of this project (`docker ps`;
  ports 3000 and 5433 are fixed). Then `git clone -b <branch> /home/m7md/a/aqar-lite ~/aqar-clean-check`
  (a folder outside `.claude/worktrees`), run `docker compose -p aqar-clean up --build` there, and follow the README by hand.
  Use a new project name (`-p`) so no old volume is reused.
- **Rationale**: a clone from the repository catches anything that only works because of ignored or untracked
  files in this worktree (`.env`, generated Prisma client, `node_modules`).
- **Alternative rejected**: run `docker compose up` in this worktree. It would reuse local files and cached volumes.

## R11. Scope of the security review

- **Decision**: `/security-review` runs on this branch's diff against `main`. Each earlier phase passed its own
  review before merge. The final README Security section states the top 3 risks across the whole system.
- **Rationale**: the review tool reviews pending changes, so "0 open issues" means this phase's changes. The
  full-system view comes from the per-phase reviews plus the README.

## R12. Agent context script

- **Decision**: skipped. `.specify/scripts/bash/` has no agent-context script in this repository. `CLAUDE.md` stays
  `@AGENTS.md` only (docs/phases.md note).
