# Feature Specification: Database Schema and Seed

**Feature Branch**: `002-schema-seed`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Create the full data model and the seed data for \"Aqar Lite\" (see docs/brief.md sections 2, 3 and 5). All later phases use this schema, so it must hold every entity and every integrity rule now. Entities: Company, User, Session, Unit, Client, Reservation, Contract, Installment, Payment, AuditLog. Goals: every user belongs to one company and has one role: manager, sales rep or accountant; the database itself rejects invalid data (negative prices, duplicate units, overpaid installments, two contracts for one reservation), even if the code has a bug; payments and audit log rows can never be changed or deleted, even with direct SQL. Seed data: 2 companies, each with 1 manager, 1 accountant and 2 sales reps; each company has at least 10 available units with different types, prices and areas, and at least 3 clients per sales rep; seed passwords are known and listed in the README; running the seed twice does not create duplicates. Done when: migrations run on an empty database with no errors; integration tests prove an UPDATE or DELETE on a payment or an audit row fails, an installment cannot have paidAmount above its amount, and a second contract for the same reservation fails. Make it on a new branch from main."

> **Note on this phase**: This phase has no screens. Its "users" are the later phases (which build on the data model), the developers who run the seed, and the reviewers who try to break the data. The database is the acceptance surface, so database terms (migration, row, UPDATE, DELETE, direct SQL) appear in the scenarios. Column types, tool choices and trigger code are left to the plan.

> **Dependency**: Phase 0 (`001-project-setup`) is not on `main` yet. This branch was cut from `main` at the user's request. Before `/speckit-implement`, phase 0 must be merged into `main` and this branch rebased onto it, because the migrations, seed and integration tests need the project, the database container and the test database from phase 0.

## Clarifications

### Session 2026-11-12

- Q: Unit area precision: whole square meters or decimals? → A: Whole square meters only (e.g. 145).
- Q: Which unit types exist? → A: Four residential types only: apartment, villa, townhouse, duplex.
- Q: Should the database refuse links between records of different companies? → A: Yes. Reservation → unit, client and sales rep; client → sales rep; contract → reservation must all be in the same company, enforced by the database.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete data model from an empty database (Priority: P1)

A developer starts from an empty database and applies all migrations. Every entity the brief needs exists afterwards: companies, staff users with one role each, login sessions, units, clients, reservations, contracts, installments, payments and the audit log. Later phases add features on top of this model without changing what is already there.

**Why this priority**: Every later phase reads and writes this data. If the model is wrong or migrations fail on a clean machine, nothing else runs, and the brief stops the evaluation when `docker compose up` fails.

**Independent Test**: Create an empty database, apply all migrations, and confirm that they finish with no errors and that every entity listed in Key Entities exists with its relationships.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** all migrations are applied, **Then** they finish with no errors and every entity in Key Entities exists.
2. **Given** a user record, **When** it is saved without a company or without a role, or with a role other than manager, sales rep or accountant, **Then** the database refuses it.
3. **Given** a user with a given email in company A, **When** another user with the same email (in any letter case) is saved in any company, **Then** the database refuses it.
4. **Given** any record that points to another record (a unit to its company, a reservation to its unit, a contract to its reservation, and so on), **When** the target does not exist, **Then** the database refuses it.
5. **Given** a record that other records point to (for example a unit with a reservation), **When** someone tries to delete it, **Then** the database refuses it instead of deleting the dependent records.

---

### User Story 2 - Database rejects invalid business data (Priority: P1)

A reviewer, or a bug in the code, tries to write data that breaks a business rule: a negative or zero price, a duplicate unit number in the same project of the same company, an installment paid above its amount, or a second contract for one reservation. The database refuses each write, so bad data never gets stored.

**Why this priority**: The brief requires integrity constraints in the database itself, not only in code (section 5), and financial accuracy is judged as part of the work. The database is the last line of defense.

**Independent Test**: Against a migrated test database, try each invalid write in the scenarios below directly and confirm each one fails while a valid version of the same write succeeds.

**Acceptance Scenarios**:

1. **Given** a company, **When** a unit is saved with a price of zero or less, an area of zero or less, or a negative number of rooms, **Then** the database refuses it.
2. **Given** a unit with number "A-101" in project "Al Narjis" of company A, **When** another unit with number "A-101" in project "Al Narjis" of company A is saved, **Then** the database refuses it.
3. **Given** the same case, **When** a unit with number "A-101" in project "Al Narjis" is saved in company B, or in another project of company A, **Then** it is accepted.
4. **Given** an installment with amount 10,000 riyals, **When** its paid amount is set to more than 10,000 riyals, **Then** the database refuses it.
5. **Given** an installment, **When** its amount is zero or less, or its paid amount is negative, **Then** the database refuses it.
6. **Given** a reservation that already has a contract, **When** a second contract is saved for the same reservation, **Then** the database refuses it.
7. **Given** a contract, **When** its final price is zero or less, its down payment is negative, its down payment is equal to or above the final price, or its number of installments is below 1, **Then** the database refuses it.
8. **Given** a contract with an installment at position 1, **When** a second installment at position 1 is saved for the same contract, **Then** the database refuses it.
9. **Given** a contract, **When** a payment with an amount of zero or less is saved, **Then** the database refuses it.
10. **Given** a payment on a contract with request key K, **When** a second payment with key K is saved on the same contract, **Then** the database refuses it; the same key on a different contract is accepted.
11. **Given** a unit, a client and a sales rep of company B, **When** a reservation of company A that points to any of them is saved, **Then** the database refuses it. The same holds for a client of company A whose sales rep is in company B, and for a contract of company A whose reservation is in company B.

---

### User Story 3 - Payments and audit log cannot be changed or deleted (Priority: P1)

Someone with direct database access through the application's database account, or a bug in the code, tries to edit or delete a recorded payment or an audit log row. Every attempt fails. New payments and audit rows can still be added.

**Why this priority**: The brief says a recorded payment cannot be edited or deleted, and nobody may edit the audit log. These are money and evidence records; the guarantee must hold even outside the application code.

**Independent Test**: Against a migrated test database, insert one payment and one audit row, then run an UPDATE and a DELETE on each with direct SQL, and confirm all four fail and both rows are unchanged.

**Acceptance Scenarios**:

1. **Given** a recorded payment, **When** an UPDATE is run on it with direct SQL, **Then** it fails and the payment is unchanged.
2. **Given** a recorded payment, **When** a DELETE is run on it with direct SQL, **Then** it fails and the payment still exists.
3. **Given** an audit log row, **When** an UPDATE is run on it with direct SQL, **Then** it fails and the row is unchanged.
4. **Given** an audit log row, **When** a DELETE is run on it with direct SQL, **Then** it fails and the row still exists.
5. **Given** the payments or the audit log, **When** someone tries to empty the whole table at once (TRUNCATE), **Then** it fails.
6. **Given** the protection is active, **When** a new payment or a new audit row is inserted, **Then** it succeeds.

---

### User Story 4 - Repeatable seed with known accounts (Priority: P2)

A reviewer starts the system and finds two ready companies, each with a manager, an accountant and two sales reps, plus sample units and clients. The README lists every seed account and its password, so the reviewer can log in as each role. Running the seed again changes nothing.

**Why this priority**: The brief requires two seeded companies with these roles and seed accounts in the README (sections 3.1 and 5). It is needed to test isolation and roles by hand, but it builds on stories 1 to 3.

**Independent Test**: Run the seed on a migrated empty database, count rows per entity, run the seed again, and count again. The counts match the targets below and do not change on the second run.

**Acceptance Scenarios**:

1. **Given** a migrated empty database, **When** the seed runs, **Then** there are exactly 2 companies, and each has exactly 1 manager, 1 accountant and 2 sales reps.
2. **Given** the seeded data, **When** the units of each company are counted, **Then** each company has at least 10 available units, covering at least 3 types, more than one price and more than one area.
3. **Given** the seeded data, **When** the clients of each sales rep are counted, **Then** each sales rep has at least 3 clients, and each client belongs to a sales rep of the same company.
4. **Given** the seed already ran, **When** it runs a second time, **Then** it finishes with no error and the number of rows in every table is unchanged.
5. **Given** the seeded users, **When** their stored passwords are inspected, **Then** none is stored as plain text; each is a one-way hash.
6. **Given** the README, **When** a reviewer reads it, **Then** it lists the email, password, role and company of every seed account.

---

### Edge Cases

- **Empty table truncation**: TRUNCATE on payments or audit logs bypasses row-level protection unless it is blocked separately; it must also fail (Story 3, scenario 5).
- **Same unit number, different scope**: the same project name and unit number is allowed in another company or another project of the same company (Story 2, scenario 3).
- **Paid amount exactly equal to amount**: allowed (fully paid). Only above the amount is refused.
- **Down payment of 0**: allowed on the contract. It means no down-payment installment is created (rule for phase 5).
- **Failed login for an email that does not exist**: the audit row has no company and no user, but it must still record the email that was tried, so phase 2 can count recent failures per email.
- **Email letter case**: `Ali@x.com` and `ali@x.com` are the same email. Otherwise an attacker could bypass the failed-login limit by changing the case.
- **Duplicate phone numbers**: two clients with the same phone are allowed, even in the same company. A uniqueness error would reveal that another rep already has this client.
- **Seed run on a database that already has data**: the seed does not create duplicates and does not fail.
- **Link across companies**: a reservation, client or contract that points to a record of another company is refused by the database, even if the referenced record exists (FR-015a).
- **Deleting a parent record**: deleting a company, unit, client, reservation or contract that other records point to is refused, never cascaded.
- **Integration tests and append-only tables**: test cleanup cannot delete payments or audit rows, so tests need a cleanup method that does not depend on deleting them (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

**Entities and relationships**

- **FR-001**: The system MUST store companies. Every other tenant record belongs to exactly one company.
- **FR-002**: The system MUST store staff users. Each user belongs to exactly one company, has exactly one role (manager, sales rep or accountant), a name, an email and a hashed password.
- **FR-003**: User email MUST be unique across all companies, because login has no company field. Uniqueness MUST ignore letter case and surrounding spaces: emails are stored trimmed and lowercased.
- **FR-004**: The system MUST store login sessions linked to one user, with an expiry time. A session MUST store only a one-way hash of the session token, never the raw token.
- **FR-005**: The system MUST store units with: company, project name (free text), unit number, type (apartment, villa, townhouse or duplex), area (whole square meters), number of rooms, price, and status (available, reserved or sold). Status MUST allow only those three values.
- **FR-006**: The system MUST store clients with: company, owning sales rep, name, phone and optional free-text notes.
- **FR-007**: The system MUST store reservations with: company, unit, client, the sales rep who made it, and the expiry time. Whether a reservation is active is derived from its expiry time and MUST NOT be stored as a separate status.
- **FR-008**: The system MUST store contracts with: company, the reservation it comes from, final price, down payment, number of monthly installments, and approval time (empty for a draft). Draft or approved MUST be derived from the approval time. Unit, client and sales rep MUST come from the reservation and MUST NOT be stored again on the contract.
- **FR-009**: The system MUST store installments with: contract, position in the schedule (0 = down payment), due date (a calendar date, no time), amount and paid amount (default 0). Installment status (unpaid, partial, paid, overdue) MUST NOT be stored.
- **FR-010**: The system MUST store payments with: contract, amount, the client-provided request key, and the time it was recorded.
- **FR-011**: The system MUST store audit log rows with: company (optional), user (optional), action (failed login, price change, contract approval or payment), the affected record (optional), extra details, and the time it was written.
- **FR-012**: A failed-login audit row MUST record the email that was tried, normalized the same way as FR-003 (trimmed, lowercased), in a form that lets later phases count failed attempts for one email in a recent time window efficiently.
- **FR-013**: All money amounts MUST be stored as whole numbers of halalas. No fractional or floating-point money anywhere.

**Integrity rules the database MUST enforce**

- **FR-014**: Every reference between records MUST be enforced by the database. A reference to a missing record MUST be refused.
- **FR-015**: Deleting a record that other records reference MUST be refused. No cascading deletes.
- **FR-015a**: Links between tenant records MUST stay inside one company, enforced by the database: a reservation's unit, client and sales rep; a client's sales rep; and a contract's reservation MUST all belong to the same company as the record that points to them.
- **FR-016**: Unit: price > 0, area > 0, rooms ≥ 0. Project name and unit number MUST be unique within one company.
- **FR-017**: Contract: final price > 0, down payment ≥ 0, down payment < final price, number of installments ≥ 1. A reservation MUST have at most one contract.
- **FR-018**: Installment: amount > 0, paid amount ≥ 0, paid amount ≤ amount. The position in the schedule MUST be unique within one contract.
- **FR-019**: Payment: amount > 0. The request key MUST be unique within one contract.
- **FR-020**: Payments MUST NOT be updatable or deletable by the application's database account, including by direct SQL and by emptying the whole table. Inserts MUST still work.
- **FR-021**: Audit log rows MUST NOT be updatable or deletable by the application's database account, including by direct SQL and by emptying the whole table. Inserts MUST still work.
- **FR-022**: Phone numbers MUST NOT be unique, to avoid revealing that another sales rep has the same client.

**Rules enforced later, not by this schema** (listed so later phases own them):

- **FR-023**: The following rules depend on the current time or on sums across rows and are enforced by the services of later phases, not by database constraints: at most one active reservation per unit (phase 4); allowed unit status transitions (phases 3–5); down payment plus installments equal the final price (phase 5); final price ≥ 95% of the unit price (phase 5); a payment not above the contract's remaining amount (phase 6).

**Migrations and seed**

- **FR-024**: The schema MUST be created only by migrations, and all migrations MUST apply on an empty database with no errors. Rules that the schema tool cannot express (for example the payment and audit protection) MUST be inside a migration too.
- **FR-025**: The seed MUST create 2 companies. Each company MUST have exactly 1 manager, 1 accountant and 2 sales reps.
- **FR-026**: Each company MUST have at least 10 units in the available status, using at least 3 different types, and with different prices and areas.
- **FR-027**: Each sales rep MUST have at least 3 clients in the same company. At least one client of each sales rep MUST have notes.
- **FR-028**: Seed passwords MUST be stored only as one-way hashes using the same hashing method the login will use. The plain-text passwords MUST appear only in the README, next to each account's email, role and company.
- **FR-029**: Running the seed again on a database that already holds seed data MUST NOT create duplicates and MUST NOT fail.
- **FR-030**: The seed MUST NOT create reservations, contracts, installments, payments or audit rows. Those come from real actions in later phases.

**Tests**

- **FR-031**: Integration tests against a real database MUST prove: an UPDATE on a payment fails; a DELETE on a payment fails; an UPDATE on an audit row fails; a DELETE on an audit row fails; an installment paid amount above its amount fails; a second contract for the same reservation fails; a reservation that points to a unit of another company fails.

### Key Entities

- **Company**: a real-estate company (tenant). Has a name. Owns users, units, clients, reservations, contracts and its audit rows.
- **User**: a staff member of one company with one role: manager, sales rep or accountant. Has a name, a globally unique email and a hashed password.
- **Session**: a login session of one user. Identified by the hash of a secret token, with an expiry time. Role and company are read from the user, not copied here.
- **Unit**: a real-estate unit of one company. Project name (text), unit number, type, area, rooms, price, status. Unique by company + project name + unit number.
- **Client**: a buyer added by one sales rep of the same company. Name, phone, optional notes.
- **Reservation**: a time-limited hold on one unit for one client, made by one sales rep. Active while its expiry time is in the future.
- **Contract**: a sale agreement created from exactly one reservation. Final price, down payment, number of installments, approval time (empty = draft).
- **Installment**: one row of a contract's payment schedule. Position (0 = down payment), due date, amount, paid amount.
- **Payment**: money received for one contract. Amount, request key, time recorded. Never changed or deleted.
- **Audit Log**: a permanent record of a sensitive event: failed login, price change, contract approval or payment. Optional company and user, the affected record, details, time. Never changed or deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Applying all migrations to an empty database finishes with 0 errors, every time, on a clean machine.
- **SC-002**: 100% of the invalid writes listed in User Story 2 are refused by the database when sent directly, with no application code involved.
- **SC-003**: 100% of attempts to change or remove a payment or an audit row (single-row update, single-row delete, whole-table empty) fail, and every stored value of those rows is unchanged afterwards.
- **SC-004**: After the first seed run, there are exactly 2 companies, 8 users (per company: 1 manager, 1 accountant, 2 sales reps), at least 20 available units and at least 12 clients.
- **SC-005**: Running the seed a second time changes the row count of every table by 0.
- **SC-006**: A reviewer can log in as each of the 8 seed accounts using only the README (verified in phase 2, when login exists).
- **SC-007**: The seven required integration tests (FR-031) pass on a fresh test database.

## Assumptions

- **Area**: whole square meters (no decimals), confirmed in Clarifications. Saudi listings use whole meters.
- **Unit types**: four residential types: apartment, villa, townhouse, duplex (confirmed in Clarifications). Commercial types are out of scope. Arabic labels are shown in the UI; the stored value is a fixed code.
- **Cross-company references**: the database refuses links between records of different companies (FR-015a, confirmed in Clarifications). Services still look up every record by the session's company first; the database is the second guard. Installments and payments are reached only through their contract, so they inherit its company. The sales rep's role (that a client's owner is really a sales rep) is checked by the services, not the database.
- **Append-only scope**: the protection stops every UPDATE, DELETE and TRUNCATE the application sends, and also direct SQL from any account. In the compose stack the application connects as the table owner, which could disable the protection on purpose (a deliberate administrative action, not something a logged-in user of the application can do). A separate least-privilege database role for the application is listed in the README "Not done" section.
- **Integration test cleanup**: because payments and audit rows cannot be deleted, integration tests reset state by recreating the test database (or its schema) before the run, or by running each test inside a transaction that is rolled back. The plan picks one.
- **Seed when data exists**: the seed checks for existing seed data (for example the seed companies or users by their unique email) and skips what already exists. The container entrypoint from phase 0 also runs the seed only on an empty database.
- **Seed passwords**: one known password per account (or one shared password), listed in the README. These are demo values only, not secrets.
- **Seed data language**: company names, project names and client names are in Arabic, to match the Arabic UI.
- **Contract company**: the contract keeps its own company reference (even though it can be reached through the reservation) so every tenant query can filter by company directly.
- **Installment and payment company**: installments and payments are reached through their contract and do not need their own company reference.
- **IDs**: all records use random unique identifiers that cannot be guessed or counted, except sessions, which are identified by the token hash.
