# Implementation Plan: Audit Log, Hardening and Delivery

**Branch**: `claude/speckit-delivery-system-949ad7` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-audit-log-delivery/spec.md`

**Gate**: none. This branch is at `origin/main` (`ff0eeee`), which has phases 0–6 merged.

## Summary

A manager reads their company's audit log: newest first, offset pages, no filters. Each row shows a colored event
badge, the Riyadh time, the actor's name (or the typed email for a failed login) and the details in readable Arabic,
with links to the unit or contract. A new `audit-log` feature (route → service → repository) reads `audit_logs`
filtered by the session company. The service parses `meta` per event type into a typed DTO and allows `MANAGER` only.
Then delivery: dependency audit, secrets check, `.env.example` check, README completion, full test run,
`/security-review`, and a clean-clone run. No schema change. No new dependency. The brief's extras are not built and
go to README "Not done".

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 LTS

**Primary Dependencies**: as in phases 0–6. **No new dependency.**

**Storage**: PostgreSQL. `audit_logs`: read only (filter `company_id`, order `created_at DESC, id DESC`, served by
the existing index `audit_logs(company_id, created_at)`). `users`: read `name`, `company_id` for the actor.
**No migration.** The append-only triggers on `audit_logs` (phase 1) already refuse `UPDATE` and `DELETE`.

**Testing**: Vitest. Unit tests (no DB) in `tests/unit`. Integration tests on a real Postgres in `tests/integration`.
Use an isolated DB for this worktree (quickstart §1), because the shared one on 5433 is wiped by other worktrees' runs.

**Target Platform**: Linux container (`docker compose up`); mobile and desktop browsers

**Project Type**: Web application (one Next.js project, feature folders)

**Performance Goals**: one page = 2 queries (rows with the actor name, and a count), both on an indexed company filter.

**Constraints**: `companyId` only from the session; `meta` never reaches the client unparsed; money shown with
`formatRiyals` (exact decimal string, no float); every text rendered as React text (no `dangerouslySetInnerHTML`,
already enforced by `tests/unit/architecture/conventions.test.ts`).

**Scale/Scope**: 1 new feature (1 route file with 1 handler, 1 service, 1 repository, 1 domain function,
1 page component with 3 child components), 1 page, 1 API route, 1 navigation entry, README completion.

## Constitution Check

*Checked before research and again after the design. All PASS.*

| # | Principle | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| I | Tenant Isolation | PASS | `findAuditLogs(companyId, …)` and `countAuditLogs(companyId)` require `companyId` from the session; null-company rows never match; the actor name is returned only when the actor is in the session company (R5). Integration test: A's manager sees none of B's rows and no null-company rows. |
| II | Server-Side Authorization | PASS | `listAuditLog` throws `FORBIDDEN` unless `role === "MANAGER"`; the route uses `handleRoute({ auth: "user" })` (401 without a session). The query schema allows only `page` and `pageSize`. Navigation hiding is display only. |
| III | Financial Accuracy | PASS | Amounts in `meta` are integer halalas, validated as `z.number().int()`, shown with `formatRiyals`. Nothing is computed or stored. |
| IV | Atomic and Concurrency-Safe | PASS (N/A) | Read only. No new write. |
| V | Database-Enforced Integrity | PASS | No schema change. Existing triggers keep `audit_logs` append-only; `tests/integration/prisma/append-only.test.ts` proves it. |
| VI | Layered Architecture | PASS | routes → service → repository; `meta` parsing is a pure domain function; the feature imports no other feature (it only reads `audit_logs` and `users`). The page passes nothing across features. Strict TS, no `any`. |
| VII | Security by Default | PASS | Zod on the query; generic errors through `handleRoute`; failed-login email rendered as text and cut by CSS with a `title`; no raw `meta`; GET only (no Origin check needed, no write). |
| VIII | Scope Discipline | PASS | No filters, export, charts or extras (clarified). No new dependency. Assumptions go to README. |

## Project Structure

### Documentation (this feature)

```text
specs/008-audit-log-delivery/
├── spec.md
├── plan.md                      # this file
├── research.md                  # R1–R12
├── data-model.md                # DTO and meta schemas (no table change)
├── quickstart.md                # validation and delivery steps
├── contracts/audit-log-api.md   # GET /api/audit-log
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code: every file created or changed

```text
# Audit log feature (new)
src/features/audit-log/audit-log.schemas.ts        new  auditLogListQuerySchema = z.object({ ...paginationFields }); one meta schema per action:
                                                        loginFailedMetaSchema { email: string max 254, reason: "invalid_credentials" | "locked" },
                                                        priceChangedMetaSchema { oldPrice, newPrice: int ≥ 0 },
                                                        contractApprovedMetaSchema { unitPrice, finalPrice, downPayment: int ≥ 0, installmentCount: int ≥ 1, startDate: YYYY-MM-DD },
                                                        paymentRecordedMetaSchema { contractId: uuid, amount: int > 0, allocation: { seq: int ≥ 0, applied: int > 0 }[], remainingAfter: int ≥ 0 }
src/features/audit-log/audit-log.types.ts          new  AuditAction; AuditEventDto (union keyed by action, see data-model.md); AuditLogListQuery; AuditLogPage = Page<AuditEventDto>
src/features/audit-log/audit-log.keys.ts           new  auditLogKeys.all = ["audit-log"]; list(query)
src/features/audit-log/domain/audit-event.ts       new  toAuditEvent(row: { id, action, entityId, meta, createdAt, actorName }) → AuditEventDto (pure; safeParse per action; bad meta → details null)
src/features/audit-log/server/audit-log.repository.ts  new  findAuditLogs(companyId, query, tx?) (where companyId, orderBy [createdAt desc, id desc], skip/take, select id, action, entityId, meta, createdAt, user { name, companyId }); countAuditLogs(companyId, tx?)
src/features/audit-log/server/audit-log.service.ts     new  listAuditLog(user, query) → AuditLogPage (MANAGER only, else FORBIDDEN; actorName only if user.companyId matches; LOGIN_FAILED actorName null)
src/features/audit-log/server/audit-log.routes.ts      new  listAuditLogHandler (GET, auth "user", parse query with toQueryInput)
src/features/audit-log/server/index.ts                 new  export { listAuditLog, listAuditLogHandler }
src/features/audit-log/client/audit-log.queries.ts     new  auditLogListOptions(query) via queryOptions() and apiFetch
src/features/audit-log/client/audit-log-page/audit-log-page.tsx      new  heading; invalid query → ErrorState with reset; loading TableSkeleton; error ErrorState + retry; empty EmptyState; AuditLogTable; PaginationNav
src/features/audit-log/client/audit-log-page/use-audit-log-page.ts   new  parse searchParams; useQuery({ ...auditLogListOptions(query), placeholderData: keepPreviousData }); setPage → router.push
src/features/audit-log/client/audit-log-page/index.ts                new
src/features/audit-log/client/audit-log-page/components/audit-log-table/audit-log-table.tsx      new  shadcn Table: النوع (badge) | الوقت (formatRiyadhDateTime) | المستخدم (actorName, or the email for LOGIN_FAILED, `truncate` + title, dir="ltr") | التفاصيل
src/features/audit-log/client/audit-log-page/components/audit-log-table/types.ts                 new  AuditLogTableProps { events; dimmed }
src/features/audit-log/client/audit-log-page/components/audit-log-table/index.ts                 new
src/features/audit-log/client/audit-log-page/components/audit-event-badge/audit-event-badge.tsx  new  Badge with label and class from constants
src/features/audit-log/client/audit-log-page/components/audit-event-badge/constants.ts           new  AUDIT_ACTION_LABELS, AUDIT_ACTION_CLASSES (4 colors)
src/features/audit-log/client/audit-log-page/components/audit-event-badge/types.ts               new
src/features/audit-log/client/audit-log-page/components/audit-event-badge/index.ts               new
src/features/audit-log/client/audit-log-page/components/audit-event-details/audit-event-details.tsx  new  per action: Arabic text with formatRiyals / formatRiyadhDate; seq 0 → "الدفعة المقدمة", else "القسط n"; links /units/{id}/edit, /contracts/{id}; null details → "—"
src/features/audit-log/client/audit-log-page/components/audit-event-details/types.ts           new
src/features/audit-log/client/audit-log-page/components/audit-event-details/index.ts           new

# Routing
src/app/api/audit-log/route.ts            new  export { listAuditLogHandler as GET } from "@/features/audit-log/server"
src/app/(app)/audit-log/page.tsx          new  requireUser(); non-MANAGER → redirect("/"); parse searchParams; prefetchQuery(auditLogKeys.list, listAuditLog); HydrationBoundary

# Shared
src/shared/lib/navigation.ts              change  + { href: "/audit-log", label: "سجل التدقيق", roles: ["MANAGER"] }

# Tests
tests/unit/features/audit-log/audit-log.schemas.test.ts                  new
tests/unit/features/audit-log/domain/audit-event.test.ts                 new
tests/unit/shared/lib/navigation.test.ts                                 change  audit log visible to MANAGER only
tests/integration/features/audit-log/server/audit-log.service.test.ts    new
tests/integration/features/audit-log/server/audit-log.routes.test.ts     new

# Delivery
README.md          change  see "README work" below
.env.example       check   already lists DATABASE_URL, APP_ORIGIN, LOG_LEVEL, TEST_DATABASE_URL, DB_HOST_PORT (every variable read by src/server/env.ts, prisma.config.ts, vitest configs, docker-compose.yml); change only if the check finds a gap
package.json / package-lock.json   unchanged  (do NOT run `npm audit fix`, R8)
```

**Structure Decision**: same single Next.js project and feature-folder layout as phases 3–6. The audit log is its own
feature (R1); it depends on no other feature.

### README work (FR-020 – FR-023)

1. Opening: replace "Through **phase 6** …" with a one-paragraph description of the finished system.
2. Running: keep it; add the audit log to the manual flow; say ports 3000 and 5433 are fixed and how to change
   `DB_HOST_PORT`; keep the volume-reset note.
3. Seed accounts: keep the table (all 8 accounts, one password).
4. Technical decisions: one pass so every bullet says what, why and the rejected alternative (brief §5); add R1, R2, R8.
5. Assumptions: add a "Phase 7: audit log" block from the spec Assumptions (no filters, null-company rows hidden,
   typed email shown for failed logins, links, extras not built).
6. Security: replace "The '3 biggest risks' section is written in the final phase." with "The 3 biggest risks":
   (1) cross-company data leak (IDOR), (2) privilege escalation and mass assignment, (3) duplicated money
   operations (double reservation, double payment, overpayment). For each: the risk, how it is handled, and the test
   that proves it. Add the dependency audit result (0 high, 0 critical; moderate findings in dev lint tooling and why
   they are not fixed).
7. New section "How company isolation is guaranteed": session-only `companyId`; every repository function requires it;
   composite foreign keys; 404 for other companies; the three pre-login lookups and why they are safe; the tests that
   prove it (the `*.service.test.ts` / `*.routes.test.ts` tenant cases per feature, by file path).
8. Not done: remove "The audit-log screen remains for the last phase"; add the three FR-023 items with how they would be
   built (event-type and date-range filter: two more validated query fields and a `WHERE`; Playwright E2E: one spec
   against the compose stack with the seed accounts; CI tests: add a Postgres service and `npm run test` +
   `npm run test:integration` to `.github/workflows/ci.yml`).
9. AI tools: keep; make it specific per phase (specs, plans, code, reviews).

### Delivery checks (order)

1. `npm ci` (this worktree's `node_modules` is stale), then lint, typecheck, unit and integration tests (quickstart §1–2).
2. `npm audit` → 0 high, 0 critical (R8).
3. Secrets check over all history (R9).
4. `.env.example` vs every variable read (list above).
5. `/security-review` on the branch (R11); fix or record each finding.
6. README final pass.
7. Clean clone in a new folder (R10), full flow by hand with the seed accounts, then the final commit.

## Rule → test map

`schemas` = `tests/unit/features/audit-log/audit-log.schemas.test.ts`, `event` =
`tests/unit/features/audit-log/domain/audit-event.test.ts`, `nav` = `tests/unit/shared/lib/navigation.test.ts`,
`svc` = `tests/integration/features/audit-log/server/audit-log.service.test.ts`, `routes` =
`tests/integration/features/audit-log/server/audit-log.routes.test.ts`.

| Rule (spec) | Test |
|---|---|
| FR-001 manager only; 401 / 403 | `svc` › "SALES → FORBIDDEN", "ACCOUNTANT → FORBIDDEN"; `routes` › "no session → 401", "SALES → 403", "ACCOUNTANT → 403", "MANAGER → 200" |
| FR-002 company from the session only | `svc` › "A's manager sees only A's rows, never B's"; `schemas` › "unknown query keys (companyId) are stripped" |
| FR-003 null-company rows hidden | `svc` › "failed login with an unknown email is not listed for any manager" |
| FR-004 nav for managers only | `nav` › "audit log item only for MANAGER" |
| FR-005 no create/edit/delete | `routes` › "audit-log route exports only GET"; existing `tests/integration/prisma/append-only.test.ts` (UPDATE and DELETE refused) |
| FR-006 newest first, stable tie-break | `svc` › "newest first", "equal createdAt: pageSize 1 over all pages lists every row once (id desc)" |
| FR-007 offset pages, default 20, max 50, total | `schemas` › "defaults page 1, pageSize 20"; `svc` › "page 2 skips the first pageSize rows; total counts all company rows" |
| FR-008 page/pageSize validated | `schemas` › "page 0, pageSize 51, non-digits → error"; `routes` › "pageSize=51 → 400 with fieldErrors.pageSize" |
| FR-009 row content (badge, time, user / typed email) | `event` › "LOGIN_FAILED has actorName null and the typed email"; `svc` › "actorName is the actor's name"; badge and time: quickstart §3 (manual) |
| FR-010 readable details per type, links | `event` › one case per action (fields mapped; unitId / contractId from entityId or meta); `svc` › "events from real writers (login, updateUnit, approveContract, recordPayment) all have non-null details" (R3); Arabic text and links: quickstart §3 |
| FR-011 exact riyals | existing `tests/unit/shared/lib/money.test.ts` (`formatRiyals`); `event` › "amounts stay integer halalas" |
| FR-012 plain text, long text cut | existing `conventions.test.ts` › "never uses dangerouslySetInnerHTML"; `event` › "email longer than 254 → details null"; quickstart §3 (script text shown as text) |
| FR-013 only display fields; no raw meta | `event` › "extra meta keys are dropped", "bad meta → details null"; `svc` › "actor from another company → actorName null" |
| FR-014 Arabic, RTL, states | quickstart §3 (manual: loading, empty, error, mobile) |
| FR-015 / FR-016 clean clone, seed | quickstart §5 (manual clean clone); existing `tests/integration/prisma/seed.test.ts` |
| FR-017 no high/critical | quickstart §4 (`npm audit`) |
| FR-018 no secrets | quickstart §4 (R9 commands) |
| FR-019 `.env.example` complete | existing `tests/unit/scripts/check-env.test.ts` + quickstart §4 (manual compare) |
| FR-020 – FR-023 README | quickstart §6 (checklist read) |
| FR-024 all tests pass | quickstart §2 |
| FR-025 security review | quickstart §4 (`/security-review`) |

## Complexity Tracking

None. No constitution violation.
