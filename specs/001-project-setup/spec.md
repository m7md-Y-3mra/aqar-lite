# Feature Specification: Project Setup and Tooling

**Feature Branch**: `001-project-setup`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Set up the empty project for \"Aqar Lite\" so later phases only add features (see docs/brief.md sections 1 and 5). This is an infrastructure phase. It has no user-facing features except an empty Arabic RTL home page. Goals: a developer clones the repository and runs `docker compose up`, and the database and the app start with no other step; the folder structure, code rules and test setup from AGENTS.md exist before any feature code is written; breaking the layer rules (importing the ORM outside repositories, importing server code into client code) fails lint or the build. Done when: `docker compose up` on a clean clone starts PostgreSQL and the app and the home page shows an Arabic RTL page; `npm run lint`, `npm run typecheck`, `npm run test` and `npm run test:integration` all run and pass (with one sample test each); a file outside a repository that imports the ORM makes `npm run lint` fail; the app refuses to start, with a clear message, if a required environment variable is missing; every pull request to main runs lint and typecheck automatically and shows a pass or fail result on the pull request. Make this on a new branch from main."

> **Note on this phase**: The "users" of this phase are developers and reviewers (the hiring team), not end users of Aqar Lite. For that reason the developer-facing commands (`docker compose up`, `npm run …`) are the acceptance surface of this spec and appear in its scenarios and requirements. Tool and library choices are left to the plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-command start on a clean machine (Priority: P1)

A reviewer clones the repository on a machine that has only Git and Docker, runs `docker compose up`, and opens the app in a browser. The database starts first, the app waits until the database is ready, prepares the database, and then serves an empty home page in Arabic, laid out right-to-left.

**Why this priority**: The brief (section 6) says that if the project does not run with `git clone` then `docker compose up`, the evaluation stops. Every later phase depends on this working.

**Independent Test**: On a fresh clone with no local configuration files and no previous containers or volumes, run `docker compose up`, wait until the app reports it is ready, and open the home page. It shows Arabic text, the page language is Arabic and the page direction is right-to-left.

**Acceptance Scenarios**:

1. **Given** a fresh clone and no previous containers or volumes, **When** the developer runs `docker compose up`, **Then** the database and the app both start with no other command or file edit, and the home page loads.
2. **Given** the app is running, **When** the home page is opened, **Then** the document declares Arabic as its language, right-to-left as its direction, and shows Arabic text.
3. **Given** the database takes longer than the app to become ready, **When** the stack starts, **Then** the app waits for the database instead of failing.
4. **Given** the stack was started once and then stopped, **When** the developer runs `docker compose up` again, **Then** it starts again with no errors and no duplicated setup work.
5. **Given** the app is running, **When** any page is requested, **Then** the response carries basic HTTP security headers.

---

### User Story 2 - Quality gates ready before feature code (Priority: P1)

A developer starting the next phase runs `npm run lint`, `npm run typecheck`, `npm run test` and `npm run test:integration`. Each command runs and passes. There is one sample unit test (no database) and one sample integration test that talks to a real PostgreSQL test database.

**Why this priority**: Later phases must add tests for financial rules, tenant isolation and concurrency (AGENTS.md section 8, constitution principles I, III, IV). The test setup must exist and be proven to work before any feature code is written.

**Independent Test**: With the database container running (`docker compose up -d db`), run the four commands. Each exits with success. Break the sample unit test on purpose and confirm `npm run test` fails.

**Acceptance Scenarios**:

1. **Given** a fresh clone with dependencies installed, **When** the developer runs `npm run lint`, **Then** it passes with no errors.
2. **Given** a fresh clone with dependencies installed, **When** the developer runs `npm run typecheck`, **Then** it passes under strict type checking.
3. **Given** a fresh clone with dependencies installed, **When** the developer runs `npm run test`, **Then** the sample unit test runs and passes without needing a database.
4. **Given** the database container is running, **When** the developer runs `npm run test:integration`, **Then** the sample integration test connects to a dedicated test database (not the app database), runs a real query, and passes.
5. **Given** the database container is not running, **When** the developer runs `npm run test:integration`, **Then** it fails with a message that says the test database is not reachable.

---

### User Story 3 - Layer rules enforced by tooling (Priority: P2)

A developer (or an AI assistant) adds code that breaks the architecture: a service or route file imports the ORM directly, or a client component imports server-only code. The automated checks catch it before review.

**Why this priority**: The brief (section 5) and the constitution (principle VI) require separated layers. Rules that only live in a document are broken under time pressure; tooling makes them hold for every later phase.

**Independent Test**: Add a file outside a repository that imports the ORM and run `npm run lint`: it fails and names the file. Add a client component that imports server-only code and run lint or the build: it fails. Remove the files and both pass again. This check is automated, not only done by hand.

**Acceptance Scenarios**:

1. **Given** a file that is not a repository file and not the single database module imports the ORM, **When** `npm run lint` runs, **Then** it fails and the message points to the file and the rule.
2. **Given** a repository file or the database module imports the ORM, **When** `npm run lint` runs, **Then** it passes.
3. **Given** a client component imports a server-only module, **When** `npm run lint` or `npm run build` runs, **Then** it fails.
4. **Given** the project's own automated tests, **When** they run, **Then** at least one test proves that a rule-breaking sample file makes lint fail, so the rule cannot be turned off silently.

---

### User Story 4 - Refuse to start with missing configuration (Priority: P2)

An operator starts the app without a required setting (for example, the database address). Instead of starting and failing later in an unclear way, the app stops at once and prints a message that names each missing or invalid setting.

**Why this priority**: The brief (section 4) requires secrets in environment variables with an example file. Failing fast with a clear message prevents a half-configured system from running on the internet.

**Independent Test**: Start the app with one required variable removed. It exits with a non-zero code and the output names that variable. Restore it and the app starts.

**Acceptance Scenarios**:

1. **Given** a required environment variable is absent, **When** the app starts, **Then** it refuses to start and the message names the missing variable.
2. **Given** a required environment variable is set to an empty string or an invalid value, **When** the app starts, **Then** it refuses to start and the message names the variable and says why it is invalid.
3. **Given** several variables are missing, **When** the app starts, **Then** the message lists all of them, not only the first one.
4. **Given** the repository, **When** a developer opens the example environment file, **Then** it lists every variable the app reads, each with a short comment, and contains no real secrets.
5. **Given** the error message for a missing variable, **When** it is printed, **Then** it never prints the values of other secret variables.

---

### User Story 5 - Automatic checks on every pull request (Priority: P3)

A developer opens a pull request to `main`. Lint and typecheck run automatically, and the pull request shows a pass or fail result without anyone running anything by hand.

**Why this priority**: Brief section 3.8 lists CI as an "Extra" item. The user asked for it in this phase because it is cheap to add now and protects every later phase.

**Independent Test**: Open a pull request to `main` with a lint error; the check shows as failed on the pull request. Fix the error and push; the check shows as passed.

**Acceptance Scenarios**:

1. **Given** a pull request targeting `main`, **When** it is opened or new commits are pushed, **Then** lint and typecheck run automatically.
2. **Given** the checks finish, **When** a reviewer views the pull request, **Then** a pass or fail result is shown on it.
3. **Given** a pull request with a lint or type error, **When** the checks run, **Then** the result is "fail".
4. **Given** the checks run, **When** they need configuration, **Then** they use non-secret placeholder values and no repository secrets.

---

### Edge Cases

- A clean clone has no local environment file: `docker compose up` must still start, because the compose setup supplies safe, non-secret development values. The "refuse to start" rule applies when a variable is truly absent or invalid in the environment the app actually receives.
- The database has no schema yet in this phase: the startup sequence (prepare database, then start the app) must succeed with zero migrations and no seed data, and keep working when later phases add them.
- The app container starts before the database accepts connections: the app waits for a healthy database instead of crashing.
- Running `docker compose up` a second time on existing volumes: no errors, no duplicate setup.
- The port used by the app or the database is already taken on the host: the error comes from Docker and is clear; the README says which ports are used.
- A rule-breaking import uses a relative path or an alias instead of the package name: the rule still catches it.
- The integration test database must be separate from the app database, so running tests never deletes or changes data the app is using.
- Scripts and test setup outside `src/` (for example the seed script and the integration-test setup added in later phases) need database access: they are allowed to use the ORM, and this exception is written in the lint configuration so it is visible.

## Requirements *(mandatory)*

### Functional Requirements

**Start and run**

- **FR-001**: Running `docker compose up` on a clean clone MUST start the database and the app with no other command, no file to copy and no manual edit.
- **FR-002**: The app MUST start only after the database is healthy, MUST apply any pending database migrations before it starts serving, and MUST run the seed only when the database is empty (the seed may be empty in this phase).
- **FR-003**: The home page MUST be an empty page with Arabic text, with the document language set to Arabic and the direction set to right-to-left, and it MUST work on both mobile and desktop widths.
- **FR-004**: The app MUST send basic HTTP security headers on every response (content-type sniffing protection, framing protection, referrer policy and a simple content security policy).

**Structure and rules**

- **FR-005**: The repository MUST contain the folder structure from AGENTS.md before any feature code: a routing-only app folder, a features folder, a backend infrastructure folder (database module, auth, HTTP wrapper, audit, environment, logger), a shared folder (lib, components, UI components), unit and integration test folders, and a database schema folder.
- **FR-006**: The backend infrastructure MUST provide the shared building blocks later phases rely on: one database client with a transaction helper; a validated environment module; a logger that hides password, token, cookie and authorization fields; an application error type with error codes, an Arabic message for every code, and a route wrapper that checks the `Origin` header on data-changing requests, maps error codes to HTTP status, returns `{ data }` or `{ error: { code, message, fieldErrors? } }`, and returns a generic Arabic message for unknown errors with details only in the log.
- **FR-007**: The client side MUST have one shared way to create the data-fetching client (a new one per server request, one shared instance in the browser), and the root layout MUST provide it together with a toast area.
- **FR-008**: Every file in the backend infrastructure folder MUST be marked server-only so it cannot be bundled into client code.
- **FR-009**: All file and folder names MUST be kebab-case.

**Layer enforcement**

- **FR-010**: `npm run lint` MUST fail when any file other than a repository file (`*.repository.ts`) or the single database module imports the ORM, whether the import uses the package name, a relative path or an alias. Scripts outside `src/` that need direct database access (seed, integration-test setup) are listed as named exceptions.
- **FR-011**: Importing server-only code into a client component MUST fail lint or the build.
- **FR-012**: An automated test MUST prove that a rule-breaking sample file makes lint fail, so the rule cannot be removed without a test failing.

**Configuration**

- **FR-013**: Every environment variable the app reads MUST be validated once at startup. If any required variable is absent, empty or invalid, the app MUST refuse to start, exit with a non-zero code, and print one clear message that lists every failing variable and the reason, without printing any secret value.
- **FR-014**: The repository MUST include an example environment file that lists every variable with a short comment and no real secrets. No real secret may be committed to the repository.

**Quality gates**

- **FR-015**: The project MUST provide the commands `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:integration`, `db:migrate` and `db:seed`.
- **FR-016**: `npm run typecheck` MUST use strict type checking and pass.
- **FR-017**: `npm run test` MUST run unit tests only, need no database, and include one passing sample test.
- **FR-018**: `npm run test:integration` MUST run against a real PostgreSQL test database that is separate from the app database and is created automatically when the database container first starts. It MUST NOT mock the database. It MUST include one passing sample test that runs a real query.
- **FR-019**: Test files MUST live in the unit and integration test folders and mirror the source paths.

**Continuous integration**

- **FR-020**: Every pull request to `main` (on open and on each new push) MUST automatically run lint and typecheck, and the result (pass or fail) MUST be shown on the pull request.
- **FR-021**: The pull request checks MUST NOT need any repository secret; they use non-secret placeholder values where configuration is required.

**Scope**

- **FR-022**: This phase MUST NOT add any business feature, data model, login, or screen other than the empty home page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a clean machine with only Git and Docker, a reviewer reaches the Arabic right-to-left home page with exactly two actions (clone, then one start command) and no file edits, in under 5 minutes on a normal internet connection.
- **SC-002**: Starting the stack a second time succeeds with zero errors in 100% of attempts.
- **SC-003**: All four quality commands (lint, typecheck, unit tests, integration tests) pass on a fresh clone, each with at least one sample check.
- **SC-004**: A file that breaks the ORM import rule makes the lint gate fail in 100% of cases, and an automated test proves this.
- **SC-005**: Removing any single required setting makes the app refuse to start in 100% of cases, and the message names that setting.
- **SC-006**: Every pull request to `main` shows a pass or fail result for lint and typecheck with zero manual steps, within 10 minutes of being opened or updated.
- **SC-007**: A developer starting the next phase adds a feature without creating any new top-level folder or shared infrastructure module.

## Assumptions

- **Users of this phase**: developers and the hiring reviewers. There are no Aqar Lite end users yet, so the home page has no login and no content beyond Arabic placeholder text.
- **Default values in the compose setup**: so that a clean clone starts with no other step, the compose setup supplies non-secret development values (for example a local database password) directly. These are for local development only and are documented as such. The "refuse to start" rule is about the environment the app actually receives; it is tested by starting the app with a variable removed.
- **Empty string counts as missing** for required variables.
- **No schema yet**: this phase has no tables. Migrations and seed run as no-ops and must succeed; phase 1 adds the schema and seed data.
- **ORM rule exceptions**: the seed script and the integration-test setup live outside `src/` and may use the ORM directly; they are named exceptions in the lint rule. All application code under `src/` follows the rule with no exceptions other than repository files and the database module.
- **Test database**: a second database in the same database container, created by an init script on first start. It is used only by integration tests.
- **CI is an "Extra" item** (brief section 3.8), added in this phase at the user's request. CI runs lint and typecheck only, as requested. Unit and integration tests in CI may be added later.
- **CI platform**: the repository is hosted on GitHub (brief section 1 requires a private GitHub repository), so the checks run on GitHub's built-in automation.
- **Ports**: the app and the database use their standard default ports on the host; the README lists them.
- **Tool and library choices** are made in the plan, following the agreed plan notes in `docs/phases.md` (phase 0).
