# Feature Specification: Units and Clients

**Feature Branch**: `004-unit-client-management`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Add unit and client management (see docs/brief.md sections 2, 3.2 and 3.3). User stories — units: as any staff user, I see the list of my company's units; I can filter by status and by price range, sort by price or area, and move between pages. As a manager, I add a unit with: project name (free text), unit number, type, area, rooms and price. As a manager, I edit a unit; I can change its price only while the unit is available. User stories — clients: as a sales rep, I add a client with name, phone and free-text notes, and I edit my clients. As a sales rep, I see only my own clients. As a manager, I see all clients of my company. The client page shows the notes as plain text. Rules: filtering, sorting and pagination happen on the server; all query parameters are validated; invalid values return 400. A unit has 3 statuses: available, reserved, sold; nobody can set the status directly; it changes only through reservation, expiry and approval. The units list always shows the correct status, even when a reservation expired and nobody opened the system since. Changing the price of a reserved or sold unit is refused. Every price change is written to the audit log with the old and the new price. Sales reps and accountants cannot add or edit units. Accountants cannot edit clients. A unit or client from another company returns 404. Done when: integration tests prove a user of company A cannot read or edit units or clients of company B; a sales rep cannot read another rep's client; the price of a reserved unit cannot change. Lists have loading, empty and error states, and form errors show next to each field."

> **Note on numbering**: This is phase 3 in `docs/phases.md`. The folder is `004-…` because `002-schema-seed` (phase 1) already exists on its own branch and `003` is kept for phase 2 (authentication).

## Clarifications

### Session 2026-11-12

- Q: What can a manager do with clients? → A: View all clients of the company, read-only. Only sales reps add and edit clients.
- Q: Can an accountant view clients? → A: Yes, all clients of the company, read-only.
- Q: Can a manager edit the non-price fields of a reserved or sold unit? → A: Yes. Only the price is locked by status; project name, unit number, type, area and rooms stay editable in every status.
- Q: Does adding a new unit write a price audit entry? → A: No. Only an edit that changes an existing price writes a price-change entry.
- Q: What order do lists use when no sort is picked? → A: Alphabetical, ascending. Units by project name then unit number; clients by name.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the company's units (Priority: P1)

Any logged-in staff user (manager, sales rep or accountant) opens the units page and sees the units of their own company only: project name, unit number, type, area, rooms, price and status. They can narrow the list by status and by a price range, sort it by price or by area (ascending or descending), and move between pages. The chosen filters, sort and page are kept in the page address, so a refresh or a shared link shows the same view.

**Why this priority**: Every later step (reservation, contract) starts from finding a unit. The list is also the place where tenant isolation and the "always correct status" rule are visible.

**Independent Test**: Log in as a user of company A with the seed data. Open the units page. Only company A units appear. Apply each filter and sort and check the result against the seed data. Change the page and confirm a different slice of units appears.

**Acceptance Scenarios**:

1. **Given** a logged-in user of company A, **When** they open the units page, **Then** they see only company A units, 20 per page by default.
2. **Given** the units page, **When** the user filters by status "available", **Then** only available units are listed and the total count reflects the filter.
3. **Given** the units page, **When** the user sets a minimum and a maximum price, **Then** only units whose price is within that range (both ends included) are listed.
4. **Given** the units page, **When** the user sorts by area descending, **Then** units are ordered from the largest area to the smallest, and units with the same area always appear in the same order across pages.
5. **Given** more units than fit on one page, **When** the user moves to the next page, **Then** the next slice is shown with no unit repeated or skipped.
6. **Given** a unit whose reservation expired 1 hour ago and no one has used the system since, **When** any user opens the units list, **Then** that unit shows as "available".
7. **Given** a unit that was sold, **When** its old reservation's time has passed, **Then** the unit still shows as "sold".
8. **Given** a filter that matches no unit, **When** the list loads, **Then** an empty state with a clear Arabic message is shown.
9. **Given** the list request fails, **When** the page shows the result, **Then** an error state with a retry action is shown, not a blank page.

---

### User Story 2 - Manager adds a unit (Priority: P1)

A manager opens a form and adds a unit with project name (free text), unit number, type, area, number of rooms and price. The new unit belongs to the manager's company and starts as "available".

**Why this priority**: Without a way to add units, the company's inventory is limited to the seed data. The brief lists this as a manager capability.

**Independent Test**: Log in as a manager, add a unit with valid values, and find it in the units list as "available". Submit the form with invalid values and confirm each error appears next to its field.

**Acceptance Scenarios**:

1. **Given** a logged-in manager, **When** they submit the form with valid values, **Then** the unit is created in their company with status "available", appears in the list, and no audit entry is written.
2. **Given** a logged-in manager, **When** they submit the form with an empty project name, a zero area or a negative price, **Then** the unit is not created and an Arabic error appears next to each invalid field.
3. **Given** a unit "Project X / 101" already exists in the manager's company, **When** they add another unit "Project X / 101", **Then** it is refused with a clear message next to the unit number field.
4. **Given** a unit "Project X / 101" exists in company B, **When** a manager of company A adds "Project X / 101", **Then** it is created successfully.
5. **Given** a manager sends a status or a company in the request by hand, **When** the unit is created, **Then** the unit is still "available" and still belongs to the manager's own company.
6. **Given** a logged-in sales rep or accountant, **When** they try to add a unit (through the UI or by calling the server directly), **Then** the request is refused and no unit is created; the add action is not shown to them.

---

### User Story 3 - Manager edits a unit and its price (Priority: P1)

A manager opens a unit of their company and edits its details. The price can be changed only while the unit is available. Every price change is written to the audit log with the old and the new price, who made it and when.

**Why this priority**: The "no price change on a reserved or sold unit" rule protects deals in progress, and it is a named test in the "done when" list.

**Independent Test**: As a manager, change the price of an available unit and confirm the new price is shown and an audit entry holds the old and new price. Then try the same on a reserved unit and confirm it is refused and the price is unchanged.

**Acceptance Scenarios**:

1. **Given** an available unit, **When** the manager changes its price, **Then** the new price is saved and one audit entry records the old price, the new price, the unit and the manager.
2. **Given** a reserved unit, **When** the manager tries to change its price, **Then** it is refused with a clear Arabic message, the price is unchanged, and no audit entry is written.
3. **Given** a sold unit, **When** the manager tries to change its price, **Then** it is refused in the same way.
4. **Given** a reserved or sold unit, **When** the manager changes only its area (price unchanged), **Then** the change is saved and no price-change audit entry is written.
5. **Given** a unit whose reservation has expired, **When** the manager changes its price, **Then** the change succeeds, because the unit is available again.
6. **Given** the manager opened the edit form while the unit was available, **When** a sales rep reserves the unit before the manager saves a new price, **Then** the price change is refused with a clear message and the price is unchanged.
7. **Given** an available unit, **When** the manager saves the form with the same price as before, **Then** no price-change audit entry is written.
8. **Given** a manager sends a status value in the edit request by hand, **When** the edit is saved, **Then** the status is not changed.
9. **Given** a logged-in sales rep or accountant, **When** they try to edit a unit by calling the server directly, **Then** the request is refused and nothing changes.

---

### User Story 4 - Sales rep manages their own clients (Priority: P1)

A sales rep adds a client with name, phone and free-text notes, and can later edit that client. The rep sees only clients they own: in the list, on the client page and when editing. A client page shows the notes exactly as typed, as plain text.

**Why this priority**: Reservations (next phase) are made for a client, and the "a rep cannot read another rep's client" rule is a named test in the "done when" list.

**Independent Test**: Log in as sales rep 1, add a client, open its page and edit it. Log in as sales rep 2 of the same company and confirm the client is not in their list and cannot be opened or edited by its direct address.

**Acceptance Scenarios**:

1. **Given** a logged-in sales rep, **When** they add a client with a name, a phone and notes, **Then** the client is saved as owned by that rep and appears in the rep's client list.
2. **Given** a sales rep, **When** they open their client list, **Then** they see only clients they own, with pages.
3. **Given** a client owned by sales rep 1, **When** sales rep 2 of the same company opens or edits that client by its direct address or by calling the server, **Then** the response is "not found" and nothing changes.
4. **Given** a client whose notes contain text that looks like HTML or script code, **When** the client page is shown, **Then** the notes appear as literal text and nothing is executed or formatted.
5. **Given** a sales rep sends an owner or a company in the request by hand, **When** the client is created or edited, **Then** the client is still owned by that rep and their company.
6. **Given** another client with the same phone number already exists (in any rep's list), **When** a rep adds a client with that phone, **Then** the client is created; no message hints that the number exists elsewhere.
7. **Given** a sales rep submits the form with an empty name or an invalid phone, **When** the server validates it, **Then** an Arabic error appears next to each invalid field.

---

### User Story 5 - Manager and accountant view clients read-only (Priority: P2)

A manager and an accountant each see all clients of their company, from every sales rep, with the owning rep shown. Both have read-only access: neither can add or edit a client.

**Why this priority**: The manager needs the full picture of the company, and the accountant needs client details when handling contracts. It is P2 because the sales flow works without it.

**Independent Test**: Log in as a manager, then as an accountant. Each time, confirm the client list contains the clients of both sales reps of the company and none of the other company, and that adding or editing a client is refused, even by calling the server directly.

**Acceptance Scenarios**:

1. **Given** a logged-in manager or accountant of company A, **When** they open the client list, **Then** they see the clients of every sales rep of company A, and no client of company B.
2. **Given** a manager or accountant, **When** they open any client page of their company, **Then** the page shows the client's name, phone, notes and owning sales rep, with no edit action.
3. **Given** a logged-in manager or accountant, **When** they try to add or edit a client by calling the server directly, **Then** the request is refused (403) and nothing changes.

---

### User Story 6 - Company isolation for units and clients (Priority: P1)

No user can read, edit or even confirm the existence of a unit or client of another company, through any page, list, direct address or query parameter.

**Why this priority**: The brief says no company may see another company's data under any condition. One leak fails the test.

**Independent Test**: For each role of company A, request a unit and a client of company B by direct address, try to edit them, and filter the lists with every parameter. Every attempt returns "not found" or excludes company B data.

**Acceptance Scenarios**:

1. **Given** a user of company A, **When** they request a unit of company B by its identifier, **Then** the response is "not found".
2. **Given** a manager of company A, **When** they try to edit a unit of company B, **Then** the response is "not found" and the unit is unchanged.
3. **Given** a user of company A, **When** they request or try to edit a client of company B, **Then** the response is "not found" and the client is unchanged.
4. **Given** a user of company A, **When** they add a company identifier to a list request, **Then** it is ignored and only company A data is returned.

---

### Edge Cases

- **Invalid list parameters**: a status outside the 3 known values, a negative or non-numeric price, a minimum price above the maximum price, a sort field other than price or area, a sort direction other than ascending or descending, a page below 1, or a page size above 50 → the server refuses the request with a validation error (400). The page shows an error state with an action to reset the filters.
- **Page past the end**: a page number beyond the last page returns an empty list with the correct total, not an error.
- **Unknown parameters**: query parameters the server does not know are ignored.
- **Equal sort values**: many units with the same price or area keep a stable order between pages, so no unit is shown twice or skipped.
- **Expired reservation, nobody active**: the status is corrected the next time anyone reads the units list or a unit, before the result is returned.
- **Race between price edit and reservation**: if the unit becomes reserved after the manager opened the form, the price change is refused; the manager sees the up-to-date status after the refusal.
- **Duplicate unit number**: the same project name and unit number twice in one company is refused with a field error; the same pair in another company is allowed.
- **Duplicate phone**: allowed, so that a uniqueness error cannot reveal another rep's client.
- **Empty notes**: allowed. Long notes keep their line breaks when shown.
- **Whitespace**: leading and trailing spaces in text fields are removed; a field that is only spaces counts as empty.
- **Out-of-reach record**: a client or unit page opened by direct address for a record the user may not see (another company, another rep's client) shows "not found", never a partial page.
- **Invalid request before lookup**: a request whose body or query is invalid is refused with a validation error (400) before any record is looked up, even when the record belongs to another company. The answer depends only on the request itself, so it reveals nothing about other companies' records.
- **Two managers change one price at once**: the first change is saved. The second is refused with a clear "the unit was just changed, reload and try again" message, so no price change is ever based on a price the manager did not see. Each saved change has its own audit entry.
- **Rounding of price input**: a price with more than 2 decimal places is refused, so no amount is silently changed.

## Requirements *(mandatory)*

### Functional Requirements

**Units — list**

- **FR-001**: The system MUST let every logged-in staff user (manager, sales rep, accountant) see the units of their own company, and only their own company.
- **FR-002**: The units list MUST support filtering by status (available, reserved, sold) and by a price range (minimum and/or maximum, both inclusive), sorting by price or area in either direction, and paging. All of this MUST be done by the server, not in the browser.
- **FR-003**: The server MUST validate every list parameter and refuse invalid values with a validation error (400). Page size defaults to 20 and cannot exceed 50.
- **FR-004**: When no sort is chosen, units MUST be ordered by project name, then unit number, ascending (text order). Units with equal sort values MUST appear in a stable order, so paging never repeats or skips a unit.
- **FR-005**: The filters, sort and page MUST be kept in the page address, so a refresh or a shared link shows the same view.
- **FR-006**: The units list and a single unit MUST always show the correct status: any reserved unit whose reservation has expired and that has no approved contract MUST be shown as available, even when nobody used the system since the expiry. A sold unit MUST never return to available.

**Units — add and edit**

- **FR-007**: Only a manager MUST be able to add a unit, with project name, unit number, type (apartment, villa, townhouse, duplex), area in whole square meters, number of rooms and price.
- **FR-008**: A new unit MUST belong to the manager's company and MUST start as available, whatever the request contains.
- **FR-009**: Project name plus unit number MUST be unique within a company. A duplicate MUST be refused with an error on the unit number field.
- **FR-010**: Only a manager MUST be able to edit a unit of their company. Project name, unit number, type, area and rooms MUST stay editable in every status; only the price is locked by status (FR-011).
- **FR-011**: A price change (a new price different from the current one) MUST be accepted only while the unit is available at the moment of saving. An edit that keeps the same price MUST NOT be refused because of the unit's status. A price change on a reserved or sold unit MUST be refused with a clear Arabic message, and the price MUST stay unchanged.
- **FR-012**: Every accepted price change MUST be written to the audit log, in the same all-or-nothing step as the change itself, with the unit, the old price, the new price, the user and the time. Saving an unchanged price, and adding a new unit, MUST NOT write an audit entry.
- **FR-013**: The system MUST ignore any unit status sent by a user, so no user can set a status directly. Status changes only through reservation, reservation expiry and contract approval (later phases).

**Clients**

- **FR-014**: A sales rep MUST be able to add a client with a name, a phone number and optional free-text notes. The client MUST be owned by that sales rep and belong to their company, whatever the request contains.
- **FR-015**: A sales rep MUST be able to edit the name, phone and notes of clients they own, and no other client.
- **FR-016**: A sales rep MUST see only clients they own, in the client list and on client pages.
- **FR-017**: A manager and an accountant MUST each see all clients of their company, with the owning sales rep shown, read-only.
- **FR-018**: The client list MUST be paged by the server, with the same page-size rules as the units list (default 20, maximum 50), ordered by client name ascending with a stable order for equal names.
- **FR-019**: The client page MUST show the notes as plain text: any HTML or script in the notes MUST be shown as literal characters and never run.
- **FR-020**: The system MUST allow duplicate phone numbers, and MUST NOT reveal in any response that a phone number is used by another client.

**Permissions and isolation**

- **FR-021**: Every permission check MUST happen on the server for every request. Hiding a button is never the check.
- **FR-022**: A unit or client of another company MUST return "not found" (404) for every read and every valid edit request. An invalid request is refused (400) first, without any lookup (see Edge Cases).
- **FR-023**: A client owned by another sales rep MUST return "not found" (404) to a sales rep, so its existence is not revealed.
- **FR-024**: A user whose role is not allowed an action MUST be refused (403): a sales rep or accountant adding or editing a unit; a manager or accountant adding or editing a client.
- **FR-025**: Only a sales rep MUST be able to add or edit clients. Managers and accountants have read-only access to all clients of their company.
- **FR-026**: Fields a user is not allowed to set (company, owner, status) MUST be ignored if sent by hand.

**Interface**

- **FR-027**: The units list, the client list and the client page MUST each show a loading state, an empty state and an error state with a retry action.
- **FR-028**: Validation errors from the server MUST be shown next to the field they belong to. A conflict (for example, the unit became reserved) MUST be shown as a message at the top of the form.
- **FR-029**: All text MUST be in Arabic and laid out right-to-left. Pages MUST work on mobile and desktop.
- **FR-030**: Actions a user's role cannot perform (add unit, edit unit, add client, edit client) MUST NOT be shown to that user.

### Permission Matrix

| Action | Manager | Sales rep | Accountant |
|---|---|---|---|
| List / view units of own company | Yes | Yes | Yes |
| Add unit | Yes | No (403) | No (403) |
| Edit unit (incl. price while available) | Yes | No (403) | No (403) |
| Add client | No (403) | Yes (owned by self) | No (403) |
| Edit client | No (403) | Own clients only (others → 404) | No (403) |
| List / view clients | All in company, read-only | Own only (others → 404) | All in company, read-only |
| Any record of another company | 404 | 404 | 404 |

### Key Entities

- **Unit**: a property for sale, belonging to one company. Has a project name (free text; no separate project record), a unit number unique within the project and company, a type (apartment, villa, townhouse, duplex), an area in whole square meters, a number of rooms, a price in halalas, and a status (available, reserved, sold) that users cannot set directly.
- **Client**: a buyer prospect, belonging to one company and owned by one sales rep. Has a name, a phone number (not unique) and optional free-text notes.
- **Price-change audit entry**: a permanent record that a unit's price changed, with the unit, the old price, the new price, the user who changed it and the time. It cannot be edited or deleted.
- **Reservation** (read only in this phase): used only to decide whether a reserved unit's reservation has expired.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Automated tests prove that, for every role, 100% of attempts by a company A user to read or edit a company B unit or client return "not found" and change nothing.
- **SC-002**: An automated test proves that a sales rep gets "not found" for 100% of attempts to read or edit another rep's client.
- **SC-003**: An automated test proves that a price change on a reserved unit is refused, the price is unchanged, and no audit entry is written; and that a change on an available unit writes exactly one audit entry with the correct old and new price.
- **SC-004**: An automated test proves that a unit whose reservation expired is listed as available on the very next read, with no other action in between.
- **SC-005**: Every invalid list parameter listed in Edge Cases returns a validation error in automated tests; none returns data or a server error.
- **SC-006**: A user can find a unit by status and price range, and reach any page of a list of 100 units, in under 30 seconds.
- **SC-007**: A manager can add a valid unit, and a sales rep can add a valid client, in under 1 minute each.
- **SC-008**: Every list and form in this feature shows its loading, empty and error states, and every field error appears next to its field, checked by hand on mobile and desktop widths.

## Assumptions

- **Depends on phases 1 and 2**: this feature needs the database schema and seed (`002-schema-seed`) and login with sessions and roles (phase 2) to be merged first. Until then it can be specified but not built.
- Area is in whole square meters and unit types are apartment, villa, townhouse and duplex, as decided in phase 1.
- Price is entered and shown in riyals with at most 2 decimal places, and stored exactly in halalas. Price filters are entered in riyals too.
- Only the price is locked by status. A manager may edit the other unit fields (project name, number, type, area, rooms) in any status (clarified 2026-11-12, following the brief's wording).
- Saving the same price is not a price change and writes no audit entry.
- Managers and accountants view clients read-only; only the owning sales rep adds and edits (clarified 2026-11-12). Managers do not add clients, so no "choose the owning rep" step is needed.
- Another rep's client returns 404, not 403, so a rep cannot discover which client identifiers exist.
- Phone validation is loose: digits with an optional leading `+`, spaces and dashes allowed, 7 to 20 characters. No country-specific format.
- Field limits: project name and client name up to 100 characters; unit number up to 20; notes up to 2,000; rooms 0 to 50; area 1 to 100,000 m²; price above 0 and up to 1,000,000,000 riyals.
- Client list has paging but no filter or search; the brief does not ask for one.
- No delete for units or clients; the brief does not ask for one, and units and clients are referenced by reservations.
- Reservations arrive in phase 4. Tests in this phase create a reserved unit and an expired reservation directly in the test database.
- The list page with invalid address parameters shows the error state with a "reset filters" action, rather than silently changing the address.
- Every decision above is recorded in the README "Assumptions" section when this phase is built.
