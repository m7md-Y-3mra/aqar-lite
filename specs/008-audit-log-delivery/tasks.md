# Tasks: Audit Log, Hardening and Delivery

**Input**: `specs/008-audit-log-delivery/` (spec.md, plan.md, research.md, data-model.md, contracts/audit-log-api.md,
quickstart.md)

**Gate**: none. The branch is at `origin/main` with phases 0–6 merged.

**Tests**: required for the audit log by the constitution (I: cross-company integration test; II: role checks) and by
the plan's rule → test map. Write each test task before the code it proves; it must fail first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no unfinished dependency)
- Commit after each task (or small group) with a Conventional Commit. Before each commit, `git diff AGENTS.md CLAUDE.md` must be empty.
- **Phase order is execution order**, not spec order: US1 (audit log) → US3 (hygiene and README) → US4 (tests and
  security review) → US2 (clean clone). The clean clone runs last because it must test the final commit (agreed
  decision).

---

## Phase 1: Setup

- [ ] T001 Prepare this worktree (quickstart §1): `npm ci`; `DB_HOST_PORT=5434 docker compose -p aqar-delivery up -d db`; `DATABASE_URL=postgresql://aqar:aqar@localhost:5434/aqar npx prisma generate`; then run `npm run lint && npm run typecheck && npm run test` and `TEST_DATABASE_URL=postgresql://aqar:aqar@localhost:5434/aqar_test npm run test:integration` and confirm the baseline is green before any change

---

## Phase 2: Foundational

None. The audit log feature depends on no other new code, and the delivery stories depend on US1 being finished.

---

## Phase 3: User Story 1 — Manager reads the company audit log (P1) 🎯 MVP

**Goal**: a manager sees their company's audit events, newest first, 20 per page, with a colored badge, Riyadh time,
the actor (or the typed email for a failed login) and readable Arabic details with links. Other roles get 403;
other companies' rows and null-company rows never appear.

**Independent test**: create events in two companies, list as A's manager (only A's rows, newest first, details not
null), then as A's sales rep and accountant (403).

### Shared types for this story

- [ ] T002 [US1] Create src/features/audit-log/audit-log.schemas.ts (`auditLogListQuerySchema = z.object({ ...paginationFields })` from src/shared/lib/pagination.ts; `loginFailedMetaSchema`, `priceChangedMetaSchema`, `contractApprovedMetaSchema`, `paymentRecordedMetaSchema` exactly as in data-model.md, with `z.number().int()` money fields and `startDate` as `YYYY-MM-DD` regex), src/features/audit-log/audit-log.types.ts (`AuditAction`, `AuditEventDto` union, `AuditLogListQuery`, `AuditLogPage = Page<AuditEventDto>`, all as in data-model.md; no `any`), and src/features/audit-log/audit-log.keys.ts (`auditLogKeys.all = ["audit-log"] as const`, `auditLogKeys.list(query)`)

### Tests (write first)

- [ ] T003 [P] [US1] Unit tests in tests/unit/features/audit-log/audit-log.schemas.test.ts: `{}` → page 1, pageSize 20; page `0`, pageSize `51`, `abc`, `-1`, `1.5` → error; an unknown key such as `companyId` is stripped from the result
- [ ] T004 [P] [US1] Unit tests in tests/unit/features/audit-log/domain/audit-event.test.ts for `toAuditEvent(row)`: one valid case per action (`LOGIN_FAILED` → `actorName` null, details `{ email, reason }`; `PRICE_CHANGED` → `unitId` from `entityId`; `CONTRACT_APPROVED` → `contractId` from `entityId`, all terms and `startDate`; `PAYMENT_RECORDED` → `contractId`, `amount`, `allocation`, `remainingAfter` from meta); extra meta keys (for example `unitId` on approval) are dropped; a missing or wrong-typed field → `details: null`; `PRICE_CHANGED` or `CONTRACT_APPROVED` with `entityId` null → `details: null`; an email longer than 254 characters → `details: null`; money values stay the same integers; `createdAt` is an ISO string
- [ ] T005 [P] [US1] Integration tests in tests/integration/features/audit-log/server/audit-log.service.test.ts (use `makeTwoCompanies` from tests/integration/support/session-users.ts and fixtures from tests/integration/support/db-fixtures.ts; insert rows with explicit `createdAt`): A's manager sees only A's rows and none of B's; a `LOGIN_FAILED` row with `companyId` null is listed for neither manager; newest first; rows with equal `createdAt` listed with `pageSize: 1` across all pages give every row exactly once (order `id` desc); page 2 skips the first `pageSize` rows and `total` counts all of A's rows; `actorName` is the actor's name; a row whose `userId` is a user of company B → `actorName` null; SALES and ACCOUNTANT → `AppError` `FORBIDDEN`; **drift test (research R3)**: create one event of each kind through its real writer — `login()` with a wrong password for a user made with `makeUserWithPassword` (src/features/auth/server/auth.service.ts), `updateUnit()` with a new price (src/features/units/server/units.service.ts), `approveContract()` (src/features/contracts/server/contracts.service.ts), `recordPayment()` (src/features/payments/server/payments.service.ts; `makeApprovedContract` in tests/integration/features/payments/server/payments-fixtures.ts may help) — then `listAuditLog()` returns all four with non-null `details` and the expected values
- [ ] T006 [P] [US1] Integration tests in tests/integration/features/audit-log/server/audit-log.routes.test.ts (follow tests/integration/features/payments/server/payments.routes.test.ts: `apiRequest`, `makeSession`, `SESSION_COOKIE`): no cookie → 401; SALES → 403; ACCOUNTANT → 403; MANAGER → 200 with `{ data: { items, total, page, pageSize } }`; `?pageSize=51` → 400 with `fieldErrors.pageSize`; the route module `@/app/api/audit-log/route` exports only `GET`

### Implementation

- [ ] T007 [US1] Implement `toAuditEvent(row)` in src/features/audit-log/domain/audit-event.ts (pure; imports only the schemas and types; `safeParse` per action; returns `AuditEventDto`; `LOGIN_FAILED` always `actorName: null`). Makes T004 pass
- [ ] T008 [US1] Create src/features/audit-log/server/audit-log.repository.ts (`import "server-only"`): `findAuditLogs(companyId, query, tx?)` → `auditLog.findMany({ where: { companyId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: toSkip(query.page, query.pageSize), take: query.pageSize, select: { id, action, entityId, meta, createdAt, user: { select: { name, companyId } } } })`; `countAuditLogs(companyId, tx?)`; use `tx ?? getDb()` like src/features/units/server/units.repository.ts
- [ ] T009 [US1] Create `listAuditLog(user, query)` in src/features/audit-log/server/audit-log.service.ts (`import "server-only"`): role ≠ `MANAGER` → `throw new AppError("FORBIDDEN")`; `Promise.all([findAuditLogs, countAuditLogs])` with `user.companyId`; map each row with `toAuditEvent`, passing `actorName = row.user?.companyId === user.companyId ? row.user.name : null`; return `{ items, total, page, pageSize }`. Makes T005 pass
- [ ] T010 [US1] Create src/features/audit-log/server/audit-log.routes.ts (`listAuditLogHandler = handleRoute({ auth: "user", handler })` parsing `auditLogListQuerySchema.parse(toQueryInput(new URL(req.url).searchParams))`), src/features/audit-log/server/index.ts (`export { listAuditLog } from "./audit-log.service"; export { listAuditLogHandler } from "./audit-log.routes";`), and src/app/api/audit-log/route.ts (`export { listAuditLogHandler as GET } from "@/features/audit-log/server";`). Makes T006 pass
- [ ] T011 [P] [US1] Add `{ href: "/audit-log", label: "سجل التدقيق", roles: ["MANAGER"] }` to `NAV_ITEMS` in src/shared/lib/navigation.ts, and in tests/unit/shared/lib/navigation.test.ts assert the item is in `navItemsFor("MANAGER")` and not in `navItemsFor("SALES")` or `navItemsFor("ACCOUNTANT")` (adjust any existing expectation that lists items by href)
- [ ] T012 [US1] Create src/features/audit-log/client/audit-log.queries.ts: `auditLogListOptions(query)` with `queryOptions({ queryKey: auditLogKeys.list(query), queryFn: () => apiFetch<AuditLogPage>(`/api/audit-log?${params}`) })`, same pattern as src/features/units/client/units.queries.ts
- [ ] T013 [P] [US1] Create the badge in src/features/audit-log/client/audit-log-page/components/audit-event-badge/ (`audit-event-badge.tsx`, `constants.ts`, `types.ts`, `index.ts`): `AUDIT_ACTION_LABELS` (`LOGIN_FAILED` "محاولة دخول فاشلة", `PRICE_CHANGED` "تغيير سعر", `CONTRACT_APPROVED` "اعتماد عقد", `PAYMENT_RECORDED` "تسجيل دفعة") and `AUDIT_ACTION_CLASSES` (red / amber / blue / green Tailwind classes on the shadcn `Badge` from src/shared/components/ui/badge.tsx, research R7)
- [ ] T014 [P] [US1] Create the details cell in src/features/audit-log/client/audit-log-page/components/audit-event-details/ (`audit-event-details.tsx`, `types.ts`, `index.ts`): per action, Arabic text with `formatRiyals` from src/shared/lib/money.ts and `formatRiyadhDate` from src/shared/lib/dates.ts; failed login → reason ("بيانات دخول غير صحيحة" / "الحساب مقفل مؤقتاً"); price change → "من X إلى Y ريال" + `Link` to `/units/{unitId}/edit`; approval → unit price, final price, down payment, installment count, start date + `Link` to `/contracts/{contractId}`; payment → amount, allocation list (seq 0 → "الدفعة المقدمة", else "القسط n": amount), remaining after + `Link` to `/contracts/{contractId}`; `details === null` → "—". Text only, no HTML strings
- [ ] T015 [US1] Create the table in src/features/audit-log/client/audit-log-page/components/audit-log-table/ (`audit-log-table.tsx`, `types.ts`, `index.ts`): plain shadcn `Table` from src/shared/components/ui/table.tsx with columns النوع (`AuditEventBadge`), الوقت (`formatRiyadhDateTime(createdAt)`), المستخدم (`actorName`, or for `LOGIN_FAILED` the `details.email` in a `span` with `dir="ltr"`, `truncate`, a max width and `title`), التفاصيل (`AuditEventDetails`); `dimmed` prop lowers opacity during placeholder data; logical classes only (`ms-`, `pe-`, …)
- [ ] T016 [US1] Create the page component in src/features/audit-log/client/audit-log-page/ (`audit-log-page.tsx`, `use-audit-log-page.ts`, `index.ts`): the hook parses `useSearchParams()` with `auditLogListQuerySchema`, runs `useQuery({ ...auditLogListOptions(query), placeholderData: keepPreviousData, enabled: valid })`, and `setPage` pushes `/audit-log?page=n` (omit defaults), like src/features/units/client/units-page/use-units-page.ts; the component renders the heading "سجل التدقيق", invalid query → `ErrorState` with `resetHref="/audit-log"`, pending → `TableSkeleton columns={4}`, error → `ErrorState` with retry, empty → `EmptyState` "لا توجد أحداث في السجل", else `AuditLogTable` + `PaginationNav`
- [ ] T017 [US1] Create src/app/(app)/audit-log/page.tsx: `requireUser()`; role ≠ `MANAGER` → `redirect("/")`; parse `searchParams` with `auditLogListQuerySchema` via `toQueryInput`; on success `prefetchQuery({ queryKey: auditLogKeys.list(parsed.data), queryFn: () => listAuditLog(user, parsed.data) })`; render `<HydrationBoundary state={dehydrate(queryClient)}><AuditLogPage /></HydrationBoundary>` (same shape as src/app/(app)/reservations/page.tsx)
- [ ] T018 [US1] Run `npm run lint && npm run typecheck && npm run test` and the integration tests (isolated DB); walk quickstart §3 by hand (badges, Riyadh time, typed email, details and links, loading / empty / error states, 375 px width, nav and redirect per role)

**Checkpoint**: US1 complete and tested; the audit log works for managers only.

---

## Phase 4: User Story 3 — Delivery hygiene: dependencies, secrets, settings and README (P1)

**Goal**: `npm audit` has 0 high and 0 critical findings, no secret is in the history, `.env.example` is complete, and
the README has all 8 required sections for the finished system.

**Independent test**: quickstart §4 commands and the §6 README checklist.

- [ ] T019 [P] [US3] Run `npm audit` and record the counts. Expected 0 high, 0 critical, 7 moderate in `@typescript-eslint/*`. Do **not** run `npm audit fix` (research R8). If a high or critical finding appears, fix it with the smallest version bump, then rerun lint, typecheck and all tests
- [ ] T020 [P] [US3] Run the two secrets commands from quickstart §4 over the full history. Expected: no output, and only `.env.example` ever added. If a real secret is found, stop and ask the user (rewriting history needs their decision)
- [ ] T021 [P] [US3] Compare every variable read in src/server/env.ts, prisma.config.ts, vitest.config*.ts, scripts/check-env.ts, docker/app/entrypoint.sh and docker-compose.yml with .env.example; add any missing one with a one-line comment and a non-secret value (expected: none missing)
- [ ] T022 [US3] README.md opening and Running: replace "Through **phase 6** …" with a short description of the finished system; in Running, add the audit log to the manual flow, say ports 3000 and 5433 are fixed and how to change `DB_HOST_PORT`, keep the volume reset note; keep the seed accounts table (all 8 accounts, one password)
- [ ] T023 [US3] README.md "Technical decisions": one pass so every bullet states what, why and the rejected alternative (brief §5); add the phase 7 decisions (audit log as its own feature, research R1; details parsed per type on the server, R2; no `npm audit fix`, R8)
- [ ] T024 [US3] README.md "Assumptions": add a "Phase 7: audit log" block from the spec Assumptions (no filters; null-company failed logins hidden; typed email shown for failed logins; links to unit and contract pages; Riyadh time; extras not built)
- [ ] T025 [US3] README.md "Security": replace "The '3 biggest risks' section is written in the final phase." with "The 3 biggest risks": (1) cross-company data leak (IDOR), (2) privilege escalation and mass assignment, (3) duplicated money operations (double reservation, double payment, overpayment). For each, give the risk, how it is handled, and the test file that proves it (find them with `grep -rln "NOT_FOUND\|FORBIDDEN\|Promise.all" tests/integration`). Add phase 7 controls (manager-only, parsed details, plain text) and the dependency audit result from T019
- [ ] T026 [US3] README.md: add a section "How company isolation is guaranteed": `companyId` only from the session (`requireUser` / `handleRoute`); every repository function requires it; composite foreign keys in the database; another company's record is 404; the three pre-login lookups (user by email, session by token hash, failed-login count by email) and why they are safe (constitution I); list the tenant-isolation test files by path (one per feature under tests/integration/features/)
- [ ] T027 [US3] README.md "Not done": remove "The audit-log screen remains for the last phase" and update the opening line; add, each with how it would be built: event-type and date-range filter for the audit log (two validated query fields and a `WHERE`, index already on `(company_id, created_at)`); Playwright E2E for reservation → contract → approval → payment (one spec against the compose stack with seed accounts); unit and integration tests in CI (a Postgres service plus `npm run test` and `npm run test:integration` in .github/workflows/ci.yml). Update "AI tools" to say per phase where AI was used (specs, plans, code, reviews)

**Checkpoint**: quickstart §6 checklist all ticked.

---

## Phase 5: User Story 4 — Final verification: tests and security review (P1)

**Goal**: everything passes and the security review has no open issue.

**Independent test**: quickstart §2 on a fresh test database, then `/security-review`.

- [ ] T028 [US4] Recreate the isolated test DB (`docker compose -p aqar-delivery down -v`, then quickstart §1) and run `npm run lint && npm run typecheck && npm run test` and `TEST_DATABASE_URL=postgresql://aqar:aqar@localhost:5434/aqar_test npm run test:integration`; all must pass with no skipped required test
- [ ] T029 [US4] Run `/security-review` on the branch (research R11: it covers this branch's diff). Fix each finding with a test and commit, or record it in README.md "Security" as a known limit with its mitigation; rerun T028 after any code fix

**Checkpoint**: 0 failing tests, 0 open security issues.

---

## Phase 6: User Story 2 — Reviewer runs the system from a clean clone (P1)

**Goal**: `git clone` + `docker compose up` in a new folder starts everything, and the full flow works by hand.

**Independent test**: quickstart §5.

- [ ] T030 [US2] Commit everything first. Run `docker ps` and stop every stack of this project using ports 3000 or 5433 (`docker compose -p <name> down`, no `-v`). Then `git clone -b claude/speckit-delivery-system-949ad7 /home/m7md/a/aqar-lite ~/aqar-clean-check` and, inside it, `docker compose -p aqar-clean up --build`. Log in with every seed account in README.md; do price change → reservation → draft → approval → payment and see all of it in the audit log as the manager; stop, run `docker compose -p aqar-clean up` again and confirm the data stays and the seed made no duplicates. If anything fails, fix it in this worktree, commit, and repeat T030 from the clone step
- [ ] T031 [US2] Clean up: `docker compose -p aqar-clean down -v` inside ~/aqar-clean-check, delete ~/aqar-clean-check, `docker compose -p aqar-delivery down -v` in this worktree

**Checkpoint**: the clean clone works; this is the version to deliver.

---

## Phase 7: Polish

- [ ] T032 Mark done tasks in specs/008-audit-log-delivery/tasks.md with any "Built:" notes where the code differs from the plan; confirm `git diff main -- AGENTS.md CLAUDE.md` is empty; final commit `docs: mark phase 7 tasks done`

---

## Dependencies

- T001 before everything.
- US1: T002 → T003–T006 (tests, parallel) → T007 → T008 → T009 → T010; T011 and T013–T014 can run beside T007–T010; T012 → T015 (needs T013, T014) → T016 → T017 → T018.
- US3 needs US1 done (the README describes the finished screen). T019–T021 run in parallel; T022–T027 edit README.md, so one at a time.
- US4 needs US1 and US3 done.
- US2 needs US4 done, because it must check the final commit.
- T032 last.

## Parallel examples

- US1 tests: T003, T004, T005, T006 together (four different test files), right after T002.
- US1 UI: T011, T013, T014 together (navigation file, badge folder, details folder).
- US3 checks: T019, T020, T021 together (read-only commands; T021 may touch only .env.example).

## Implementation strategy

1. **MVP** = Phase 1 + US1 (T001–T018): the audit log is the only new feature the brief still lacks.
2. Then US3 (README and hygiene), because the README is read before the interview.
3. Then US4 (full tests and security review), then US2 (clean clone) on the final commit.
4. If time runs out: US1 and US2 come first (a feature that is missing or a system that does not start stops the
   evaluation); README gaps are written honestly in "Not done".
