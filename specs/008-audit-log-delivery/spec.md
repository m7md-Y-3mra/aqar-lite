# Feature Specification: Audit Log, Hardening and Delivery

**Feature Branch**: `claude/speckit-delivery-system-949ad7`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Finish the system for delivery (see docs/brief.md sections 2, 4, 5 and 6). User stories: As a manager, I read my company's audit log: failed logins, price changes, contract approvals and payments, newest first, with pages. As a reviewer, I clone the repository on a clean machine, run `docker compose up`, and use the system with the seed accounts. Rules: Only managers can read the audit log. Nobody can edit or delete it. `npm audit` shows no high or critical vulnerabilities. No secrets in the repository or its git history. `.env.example` lists every variable. The README has: how to run, seed accounts per role, technical decisions (what, why, rejected alternative), assumptions, the 3 main security risks and how each is handled, how company isolation is guaranteed, what is not done and how it would be done, and where AI tools were used. Extra (only if everything above is done and all tests pass): One Playwright E2E test for: reservation, then contract, then approval, then payment. GitHub Actions running lint, typecheck and tests. Done when: A fresh clone in a new folder starts with `docker compose up`, and the full flow works by hand with the seed accounts. All tests pass, and `/security-review` shows no open issues."

> **Note on numbering**: This is phase 7 (the last phase) in `docs/phases.md`. The folder is `008-…` because `007` is used by phase 6 (`007-contract-payments`).

> **Starting point**: This branch was fast-forwarded to `origin/main` at `ff0eeee`, which already holds phase 6 (payments). Every earlier phase is merged, so this phase may be built on top of it (constitution, Development Workflow).

> **Note on technical terms**: Some requirements name concrete tools (`docker compose up`, `npm audit`, `.env.example`, README, Playwright, GitHub Actions). They are taken word for word from the brief's own acceptance rules (sections 1, 3.8, 4, 5 and 6), so they are the requirement itself, not a design choice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manager reads the company audit log (Priority: P1)

A manager opens "سجل التدقيق" (audit log) from the navigation. They see a table of the security and money events of their own company, newest first: failed logins, unit price changes, contract approvals and payments. Each row shows when it happened (Saudi time), the kind of event in Arabic, who did it (or, for a failed login, which account was targeted), what it was about (a unit, a contract or a payment), and short details (for example the old and new price, or the payment amount and how it was spread over the installments). The manager moves between pages and may narrow the list to one kind of event. Nothing on the page can change or remove a row.

**Why this priority**: The brief lists "read the audit log" as a manager right (section 2) and lists the four audited events as a security requirement (section 4). The events are already written by earlier phases; without this screen nobody can read them.

**Independent Test**: Log in as the manager of company A after a failed login, a price change, a contract approval and a payment have happened in both companies. Confirm the list shows exactly company A's four events, newest first, with readable Arabic details and riyal amounts, and none of company B's events. Then log in as a sales rep and an accountant of company A and confirm neither can open the page or call the server for it.

**Acceptance Scenarios**:

1. **Given** a manager whose company has audit events, **When** they open the audit log, **Then** they see their company's events, newest first, 20 per page, with a way to move to the next and previous page and the total count.
2. **Given** two events with the same time, **When** the list is shown, **Then** their order is stable on every load and every page (no row appears on two pages or on none).
3. **Given** a price change event, **When** it is shown, **Then** the details show the unit, the old price and the new price in riyals (with halalas when they are not zero).
4. **Given** a contract approval event, **When** it is shown, **Then** the details show the contract, the unit price, the final price, the down payment, the installment count and the start date.
5. **Given** a payment event, **When** it is shown, **Then** the details show the contract, the amount, how it was allocated to the installments (installment number and amount applied; installment 0 shown as the down payment), and the remaining amount after the payment.
6. **Given** a failed login against an account of the manager's company, **When** it is shown, **Then** the row says which account was targeted and why it failed (wrong credentials or account locked), labelled as the targeted account, not as the person who acted.
7. **Given** a failed login with an email that belongs to no account, **When** any manager opens the audit log, **Then** that event is not shown, because it belongs to no company.
8. **Given** the manager chooses one event type, **When** the list reloads, **Then** only that type is shown, the page returns to 1, and the choice is kept in the page address so reload and the back button keep it.
9. **Given** a page number past the last page, **When** the list loads, **Then** it shows the empty state, not an error.
10. **Given** an invalid page number, page size, or event type in the address or in a direct server call, **When** the request is made, **Then** it is refused as invalid input (400) and nothing is read.
11. **Given** a company with no audit events yet, **When** the manager opens the audit log, **Then** an empty state in Arabic is shown.
12. **Given** a slow or failed load, **When** the page is open, **Then** a loading state and, on failure, a generic Arabic error with a retry are shown.
13. **Given** a logged-in sales rep or accountant, **When** they open the audit log page or call the server for it directly, **Then** they are refused (403 from the server; the page does not show the data) and the navigation does not show the audit log to them.
14. **Given** a visitor who is not logged in, **When** they open the audit log page or call the server for it, **Then** the page sends them to login and the server answers 401.
15. **Given** a manager of company A, **When** they try in any way (address, query values, direct server calls) to read company B's audit events, **Then** they never see any of them.
16. **Given** any user, **When** they try to change or delete an audit event through the system or by direct database access, **Then** it is refused; the system offers no edit or delete action at all.
17. **Given** a failed login where the attacker typed HTML or script text as the email, **When** the manager reads that row, **Then** it is shown as plain text, nothing runs, and very long text is cut short.

---

### User Story 2 - Reviewer runs the system from a clean clone (Priority: P1)

A reviewer with only Git and Docker clones the repository into a new folder and runs `docker compose up`. The database starts, the schema is created, the seed data is loaded and the app starts, with no other step. The reviewer opens the app, logs in with the seed accounts listed in the README for each role, and walks the full flow by hand: a sales rep reserves a unit for a client, creates a draft contract, an accountant approves it, records a payment, and the manager sees the price change, approval and payment in the audit log.

**Why this priority**: The brief says "If it does not run, the evaluation stops" (section 6). Every other requirement is worthless if this fails.

**Independent Test**: In a new folder outside every existing worktree, with no other copy of the app or database running, run `git clone` and `docker compose up`, then follow the README to complete the full flow by hand with the seed accounts.

**Acceptance Scenarios**:

1. **Given** a machine with only Git and Docker and no earlier data volume for this project, **When** the reviewer runs `git clone` and then `docker compose up`, **Then** the database, schema, seed and app all start with no further command, and the app answers on the address the README gives.
2. **Given** the running system, **When** the reviewer logs in with each seed account in the README (manager, accountant and two sales reps, for both companies), **Then** every login works and shows the navigation for that role.
3. **Given** the running system, **When** the reviewer does reservation → contract draft → approval → payment with the seed accounts, **Then** each step succeeds, the schedule and remaining amount are correct, and the manager sees the approval and payment in the audit log.
4. **Given** the system was started once, **When** the reviewer stops it and runs `docker compose up` again, **Then** it starts again with the existing data and the seed does not create duplicates.

---

### User Story 3 - Delivery hygiene: dependencies, secrets, settings and README (Priority: P1)

Before delivery, the repository is checked for the brief's infrastructure and documentation rules: the dependency audit has no high or critical findings, no secret is in the files or the git history, every setting the system reads is listed in the example settings file, and the README has every section the brief asks for, written from the decisions of all phases.

**Why this priority**: These are required items in brief sections 4, 5 and 6, and the README is read before the interview.

**Independent Test**: Run the dependency audit and read its summary; search the files and full git history for secrets; compare every setting read by the app, the compose file and the tooling with the example settings file; read the README against the list of required sections.

**Acceptance Scenarios**:

1. **Given** the final dependency set, **When** the dependency audit runs, **Then** it reports no high and no critical vulnerabilities.
2. **Given** the repository and its full git history, **When** they are searched for secrets (private keys, real passwords, API keys, tokens, production connection strings), **Then** none is found. The only credentials present are the documented local development values (the local database user and password, and the demo password of the seed accounts).
3. **Given** every setting read by the app, the container setup and the test tooling, **When** it is compared with `.env.example`, **Then** every setting is listed there with a one-line explanation and a non-secret example value.
4. **Given** the README, **When** a reviewer reads it, **Then** it has all of these sections, current for the finished system: how to run from a clean machine; the seed accounts for each role in each company; technical decisions (what was chosen, why, and which alternative was rejected); assumptions (every unclear business rule and the decision taken); the 3 biggest security risks and how each is handled; how company isolation is guaranteed; what is not done and how it would be built; and where AI tools were used.
5. **Given** the README's opening and "Not done" sections, **When** the phase is finished, **Then** they no longer describe the system as partly built (for example "through phase 6" or "the audit-log screen remains").

---

### User Story 4 - Final verification: tests and security review (Priority: P1)

Before delivery, the whole test suite passes and a security review of the finished branch finds no open issue. Any issue found is fixed or, if it is a known limit, written in the README with how it would be handled.

**Why this priority**: The brief judges quality and security before features, and the constitution makes a passing security review part of "done" for every phase.

**Independent Test**: Run lint, type checking, unit tests and integration tests on a fresh test database, then run the security review on the branch and read its findings.

**Acceptance Scenarios**:

1. **Given** the finished branch and a fresh test database, **When** lint, type checking, unit tests and integration tests run, **Then** all pass with no skipped required test.
2. **Given** the finished branch, **When** the security review runs, **Then** it reports no open issue; every finding was fixed, or recorded in the README as a known limit with its mitigation.

---

### User Story 5 - Extra: end-to-end test of the main flow (Priority: P3)

Only after Stories 1–4 are complete and every test passes: one automated browser test logs in as a sales rep, reserves a unit, creates a draft contract, logs in as an accountant, approves it and records a payment, and checks that the payment shows on the contract.

**Why this priority**: The brief marks it "Extra" (section 3.8). It raises the score only when required work is complete.

**Independent Test**: Start the system, run the end-to-end test, and confirm it passes from a clean seed and fails if any step breaks.

**Acceptance Scenarios**:

1. **Given** a running system with the seed data, **When** the end-to-end test runs, **Then** it completes reservation → contract → approval → payment through the real UI and passes.
2. **Given** the test has run once, **When** it runs again on the same data, **Then** it still passes (it picks an available unit and does not depend on fixed records that the first run used up).

---

### User Story 6 - Extra: continuous checks on every pull request (Priority: P3)

Only after Stories 1–4 are complete and every test passes: every pull request to the main branch runs lint, type checking, unit tests and integration tests (with a real database) automatically, and a failure is visible on the pull request.

**Why this priority**: The brief marks it "Extra" (section 3.8). The repository already runs lint and type checking on pull requests; tests are missing.

**Independent Test**: Open a pull request and confirm all four checks run and pass; push a commit that breaks a test and confirm the check fails.

**Acceptance Scenarios**:

1. **Given** a pull request to the main branch, **When** it is opened or updated, **Then** lint, type checking, unit tests and integration tests run against a real database and their result shows on the pull request.
2. **Given** a change that breaks a test, **When** the checks run, **Then** the pull request shows a failed check.

---

### Edge Cases

- A failed login for an account of company A is shown to company A's manager; the same email typed wrongly so that it matches no account is shown to no one.
- An attacker who knows a company user's email can fill that company's audit log with failed logins. Each row is still shown correctly and the pages keep working; the lock rule from phase 2 still applies.
- The text of a failed-login email is chosen by an outsider; it is shown only as plain text and cut to a safe length.
- A user who did the action is still shown by name even if they later cannot log in (accounts are never deleted; no user management exists).
- An event refers to a unit, contract or payment; its reference is shown even though the event row only stores ids and details. A reference never reveals data of another company.
- Money in event details is stored in halalas; it is shown in riyals with no rounding error (for example 12,345.67).
- New events written while the manager is on page 2 may shift rows; this is accepted (offset pages), and the order of rows that existed already stays stable.
- Port 3000 or the database port is already used on the reviewer's machine: the README says which ports are used and how to change the database port.
- A data volume from an older version of the project exists: the README says how to reset it.
- A dependency fix for an audit finding needs a major version change: it is only taken if lint, type checking and all tests still pass; otherwise the finding is recorded with the reason if it is not high or critical.

## Requirements *(mandatory)*

### Functional Requirements

**Audit log — access and isolation**

- **FR-001**: Only users with the manager role MUST be able to read the audit log. Every server request for it MUST check the role on the server; sales reps and accountants get 403 and visitors without a session get 401.
- **FR-002**: The audit log MUST show only events whose company is the company of the logged-in manager, taken from the server session. No request value may choose or widen the company.
- **FR-003**: Events without a company (failed logins with an unknown email) MUST NOT be shown to any user.
- **FR-004**: The navigation MUST show the audit log only to managers. Hiding it is not the permission check (FR-001 is).
- **FR-005**: The system MUST NOT offer any way to create, edit or delete an audit event from the audit log screen or its server endpoint. Events are still written only by the four existing actions, and the database keeps refusing any change or delete of an event.

**Audit log — content and order**

- **FR-006**: The list MUST be ordered newest first, with a stable second key so equal times keep the same order on every load.
- **FR-007**: The list MUST be paged on the server: 20 per page by default, at most 50, with the total count of matching events.
- **FR-008**: The manager MUST be able to narrow the list to one event type: failed login, price change, contract approval or payment. Without a choice, all four are shown.
- **FR-009**: Page, page size and event type MUST be validated on the server; invalid values are refused with 400 and field details. The page's address MUST hold these values so reload and back keep them.
- **FR-010**: Each row MUST show: the time in Saudi time (Asia/Riyadh); the event type in Arabic; the actor's name, or for a failed login the targeted account labelled as "الحساب المستهدف"; the subject (unit, contract or payment) in readable form; and the event details.
- **FR-011**: Event details MUST be shown in readable Arabic: price change → old and new price; contract approval → unit price, final price, down payment, installment count and start date; payment → contract, amount, allocation per installment (installment 0 as the down payment) and the remaining amount after it; failed login → the email that was typed and the reason (wrong credentials or locked).
- **FR-012**: Every amount in event details MUST be shown in riyals converted from integer halalas with exact arithmetic, never with floating point.
- **FR-013**: Every text taken from event details or user records MUST be shown as plain text, never as HTML, and long free text (such as a typed email) MUST be cut to a safe length on display.
- **FR-014**: The server MUST return only the fields needed for display. It MUST NOT return session data, password hashes, or any record of another company, and it MUST NOT expose the raw stored details object unchecked.
- **FR-015**: The audit log screen MUST be Arabic, right-to-left, usable on mobile and desktop, and have loading, empty and error states.

**Delivery and hardening**

- **FR-016**: On a clean machine with only Git and Docker, `git clone` followed by `docker compose up` MUST start the database, apply the schema, load the seed data and start the app with no other step. Running it again MUST keep the data and not duplicate the seed.
- **FR-017**: The seed MUST provide, for each of the two companies, one manager, one accountant and two sales reps with known passwords listed in the README, plus sample units and clients, so that the full flow can be done by hand.
- **FR-018**: The dependency audit MUST report no high or critical vulnerabilities.
- **FR-019**: The repository and its full git history MUST contain no secrets. Local development credentials (local database user and password, demo password) are allowed only because they are documented as local, non-secret values.
- **FR-020**: `.env.example` MUST list every setting the app, the container setup and the test tooling read, each with a short explanation and a non-secret value.
- **FR-021**: The README MUST contain every section listed in User Story 3, scenario 4, and MUST be current for the finished system.
- **FR-022**: The README "Security" section MUST name the 3 biggest risks and how each is handled: (1) a leak of data across companies (reading or changing another company's record by guessing its id); (2) privilege escalation and mass assignment (a user acting outside their role or setting fields they may not set); (3) duplicated money operations (double reservation, double payment, overpayment under concurrent requests).
- **FR-023**: The README MUST have a section "How company isolation is guaranteed" that explains, for a reviewer: the company comes only from the server session; every data access requires and filters by it; records of another company answer "not found"; the few lookups before login that cannot take a company and why they are safe; and which tests prove it.
- **FR-024**: Lint, type checking, unit tests and integration tests MUST all pass on the finished branch, using a fresh test database.
- **FR-025**: A security review of the finished branch MUST show no open issue. Each finding is fixed, or recorded in the README as a known limit with its mitigation.

**Extra (only after FR-001 to FR-025 are met and every test passes)**

- **FR-026**: One end-to-end browser test MUST cover reservation → contract → approval → payment through the real UI, and MUST be repeatable on the same data.
- **FR-027**: Every pull request to the main branch MUST run lint, type checking, unit tests and integration tests against a real database.

### Permissions Summary

| Action | Manager | Accountant | Sales rep | Not logged in |
|---|---|---|---|---|
| Read own company's audit log | Yes | No (403) | No (403) | No (401 / login) |
| Read another company's audit log | No (never shown) | No | No | No |
| Edit or delete an audit event | No (no action exists; database refuses) | No | No | No |

### Key Entities *(include if feature involves data)*

- **Audit event** (existing, read only in this phase): one recorded security or money event. Holds the company (empty for a failed login with an unknown email), the user involved (the actor, or the targeted account for a failed login; may be empty), the event type (failed login, price change, contract approval, payment), the subject it refers to (unit, contract or payment; may be empty), the event details, and the time. Never changed or deleted.
- **User** (existing): gives the display name of the actor or targeted account. Always in the same company as the event.
- **Unit, Contract, Payment** (existing): the subjects that events refer to; used only to show a readable reference within the same company.

No new entity and no schema change are expected in this phase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer with only Git and Docker gets from `git clone` to a working login page with one command, and completes reservation → contract → approval → payment by hand with the seed accounts, following only the README.
- **SC-002**: In tests, a manager of one company sees 100% of their company's audit events and 0 events of the other company and 0 events without a company.
- **SC-003**: In tests, 100% of audit log read attempts by sales reps and accountants are refused, and requests without a session are refused.
- **SC-004**: A manager can find any of the four event types for their company within 3 actions (open the page, choose the type, move pages).
- **SC-005**: The dependency audit shows 0 high and 0 critical vulnerabilities.
- **SC-006**: A secrets search over the full git history finds 0 secrets beyond the documented local development values.
- **SC-007**: 100% of the settings read by the system appear in `.env.example`.
- **SC-008**: The README has all 8 required sections (run, seed accounts, decisions, assumptions, top 3 security risks, company isolation, not done, AI tools), and none describes the system as partly built.
- **SC-009**: All lint, type checking, unit and integration tests pass, and the security review ends with 0 open issues.
- **SC-010** (Extra): The end-to-end test passes twice in a row on the same data, and every pull request shows the result of all four automated checks.

## Assumptions

- **Filters**: the audit log has one optional filter, the event type, plus pages. No date range, no user filter and no search: the brief asks only to read the log, and the phase notes say to keep filters minimal. `/speckit-clarify` may revisit this.
- **No platform-wide view**: failed logins with an unknown email belong to no company and are shown to no one in the app; they stay in the database for the login lock and for operators with database access. There is no super-admin role in the brief.
- **Failed login "user"**: for a failed login, the stored user is the account that was targeted, not proof that this employee typed the wrong password; the screen labels it that way.
- **Time zone**: event times are shown in Asia/Riyadh, like every other date in the system.
- **Read only, no export**: the audit log has no export, charts or statistics (export and dashboard are out of scope).
- **Event details**: the screen reads only the details already written by phases 2, 3, 5 and 6. No change to what is written is needed.
- **Local credentials**: the local database user/password in the container setup and the shared demo password of the seed accounts are development values, documented in the README; they are not secrets and would be replaced by real secrets in any deployment.
- **Clean-clone test**: it runs in a new folder with every other copy of this project stopped, because the app port and the database port are fixed on the host.
- **Extras need approval**: the end-to-end test needs a new testing dependency; per AGENTS.md this is asked for before it is added, even though the brief names it. The pull request workflow already runs lint and type checking; the extra adds the two test runs and a database service.
- **README**: most required sections already exist from earlier phases; this phase completes them (top 3 risks, company isolation, final "Not done"), updates outdated text, and checks every section against the finished system.
