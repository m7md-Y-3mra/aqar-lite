# Feature Specification: Unit Reservations

**Feature Branch**: `claude/unit-reservations-16e517`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Add unit reservations (see docs/brief.md sections 2 and 3.4). User stories: As a sales rep, I reserve an available unit for one of my own clients. As a sales rep, I see my active reservations and when each one expires. As a manager, I see all active reservations in my company. Rules: A reservation is valid for 72 hours from the moment it is created. After 72 hours, if no contract was approved, the unit is available again with no manual action. A unit can have at most one active reservation. When two sales reps reserve the same unit at the same moment, exactly one succeeds. The other gets a clear Arabic message that the unit was just reserved. A sales rep cannot reserve for a client who belongs to another rep. Only sales reps can reserve. Reservations cannot be cancelled by hand (out of scope). Done when: A test sends two reservation requests for the same unit in parallel and proves only one succeeds. A test proves an expired reservation makes the unit available again. A test proves a rep cannot reserve for another rep's client."

> **Note on numbering**: This is phase 4 in `docs/phases.md`. The folder is `005-…` because `003` is used by phase 2 (`003-auth-app-shell`) and `004` by phase 3 (`004-unit-client-management`), each on its own branch.

> **Dependency**: This branch was cut from `main`, which does not have phase 2 (login, sessions, roles, the app shell) or phase 3 (units, clients, and the step that returns units with an expired reservation to "available"). Both phases must be merged into `main`, and this branch rebased onto it, before `/speckit-implement`. The plan may be written now.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sales rep reserves an available unit for their own client (Priority: P1)

A sales rep finds an available unit in the units list, chooses "reserve", picks one of their own clients, and confirms. The unit becomes reserved for 72 hours from that moment. No other rep can reserve it while the reservation is active. If another rep reserved the same unit a moment earlier, the rep sees a clear Arabic message that the unit was just reserved, and nothing is saved.

**Why this priority**: Reservation is the first step of the sales flow. A contract (phase 5) can only be created from an active reservation. The "two reps at the same moment" rule is named in the brief and must hold under real concurrent requests.

**Independent Test**: Log in as a sales rep with the seed data, reserve an available unit for one of the rep's clients, and confirm the unit shows as reserved with an expiry 72 hours later. Then send two reservation requests for one available unit at the same moment, from two different reps, each for their own client, and confirm exactly one succeeds.

**Acceptance Scenarios**:

1. **Given** a sales rep, an available unit of their company and a client the rep owns, **When** the rep reserves the unit for that client, **Then** the reservation is saved with an expiry exactly 72 hours after the moment it was created, the unit shows as "reserved", and the rep sees a success message.
2. **Given** a unit that is already reserved by an active reservation, **When** any sales rep tries to reserve it, **Then** the request is refused with a clear Arabic message that the unit is no longer available (it was just reserved), and nothing changes.
3. **Given** a sold unit, **When** a sales rep tries to reserve it, **Then** the request is refused with the same "no longer available" message, and nothing changes.
4. **Given** one available unit and two sales reps of the same company, each with their own client, **When** both send a reservation request for that unit at the same moment, **Then** exactly one request succeeds, the other is refused with the "unit was just reserved" message, exactly one reservation exists for the unit, and the unit is reserved for the winning rep's client.
5. **Given** a sales rep and a client that belongs to another sales rep of the same company, **When** the rep tries to reserve any unit for that client (through the UI or by calling the server directly), **Then** the request is refused as "not found", no reservation is created, and the unit stays available.
6. **Given** a sales rep of company A, **When** they try to reserve a unit of company B, or reserve for a client of company B, **Then** the request is refused as "not found", and nothing changes in either company.
7. **Given** a logged-in manager or accountant, **When** they try to reserve a unit by calling the server directly, **Then** the request is refused as "not allowed" and nothing changes. The reserve action is not shown to them.
8. **Given** a sales rep, **When** they send by hand an expiry time, a different sales rep, a company or a unit status together with the reservation, **Then** those values are ignored: the expiry is still 72 hours from creation, the rep is the logged-in rep, and the company is the rep's own company.
9. **Given** a sales rep with no clients, **When** they open the reserve action on an available unit, **Then** they see a clear Arabic message that they must add a client first, with a link to add one.
10. **Given** a reservation request that is refused for any reason, **When** the refusal is returned, **Then** the unit's status is exactly what it was before the request.

---

### User Story 2 - An expired reservation makes the unit available again with no manual action (Priority: P1)

When 72 hours pass after a reservation was created and no contract was approved for it, the unit becomes available again. Nobody has to press anything and no background job is needed: the next time anyone views the unit, the units list or the reservations list, or tries to reserve the unit, the unit is shown and treated as available.

**Why this priority**: The brief requires that the unit returns to available after 72 hours with no manual action. Without it, units would stay blocked forever after an abandoned reservation. It is a named test in the "done when" list.

**Independent Test**: Create a reservation, move its expiry time into the past (as if more than 72 hours had passed), then open the units list as any user and confirm the unit shows as "available". Then reserve the same unit as a second rep for their own client and confirm it succeeds.

**Acceptance Scenarios**:

1. **Given** a reservation created more than 72 hours ago with no approved contract, **When** any user opens the units list or that unit, **Then** the unit shows as "available".
2. **Given** a unit whose reservation expired, **When** a sales rep (the same rep or another one) reserves it for their own client, **Then** the new reservation succeeds with a new 72-hour expiry.
3. **Given** a reservation whose expiry time is exactly now, **When** the system checks it, **Then** it is treated as expired (a reservation is active only while its expiry time is still in the future).
4. **Given** an expired reservation, **When** the rep or a manager opens the reservations list, **Then** it no longer appears among the active reservations.
5. **Given** an expired reservation, **When** the unit becomes available again, **Then** the old reservation is kept as history and is not deleted.
6. **Given** a unit that was sold from a reservation (contract approved, phase 5), **When** the reservation's 72 hours pass, **Then** the unit stays "sold" and never returns to available.

---

### User Story 3 - Sales rep sees their own active reservations and when each expires (Priority: P2)

A sales rep opens the reservations page and sees only their own active reservations: the unit (project name and unit number), the client, the expiry date and time, and how much time is left. The soonest to expire is shown first, so the rep knows which deal needs attention.

**Why this priority**: A rep needs to follow up before a reservation runs out and to start the contract from it (phase 5). It is P2 because the reservation itself (Story 1) delivers value without the list.

**Independent Test**: As sales rep 1, make two reservations. As sales rep 2, make one. Log in as rep 1 and confirm the list shows exactly rep 1's two reservations, with the correct expiry and time left, soonest first.

**Acceptance Scenarios**:

1. **Given** a sales rep with active reservations, **When** they open the reservations page, **Then** they see only their own active reservations, each with the unit's project name and number, the client's name, the expiry date and time in Saudi time (Asia/Riyadh), and the time left.
2. **Given** another rep of the same company has active reservations, **When** the first rep opens the list, **Then** none of the other rep's reservations appear.
3. **Given** a sales rep with no active reservations, **When** they open the page, **Then** an empty state with a clear Arabic message is shown, with a link to the units list.
4. **Given** more active reservations than fit on one page, **When** the rep moves to the next page, **Then** the next slice is shown with no reservation repeated or skipped.
5. **Given** the list request fails, **When** the page shows the result, **Then** an error state with a retry action is shown, not a blank page.

---

### User Story 4 - Manager sees all active reservations in the company (Priority: P2)

A manager opens the reservations page and sees every active reservation in their own company, from every sales rep, with the same details as the rep's view plus the name of the sales rep who made it. The manager cannot reserve.

**Why this priority**: The brief says the manager sees everything inside their company. It is P2 because the sales flow works without it.

**Independent Test**: With reservations from both reps of company A and from a rep of company B, log in as the manager of company A and confirm the list shows the reservations of both company A reps and none of company B.

**Acceptance Scenarios**:

1. **Given** active reservations from several reps of company A, **When** the manager of company A opens the reservations page, **Then** they see all of them, each with the unit, the client, the sales rep, the expiry date and time, and the time left.
2. **Given** active reservations in company B, **When** the manager of company A opens the list, **Then** none of company B's reservations appear.
3. **Given** a logged-in accountant, **When** they open the reservations page or call the reservations list on the server directly, **Then** the request is refused as "not allowed", and the reservations section is not shown in their navigation.

---

### Edge Cases

- **Exactly 72 hours**: a reservation is active only while its expiry time is still in the future. At the exact expiry moment it counts as expired.
- **Double click on "reserve"**: the button cannot be pressed again while the request runs. If a second request still arrives, it is refused with the "no longer available" message and the first reservation stays.
- **Same rep, two clients, one unit**: the second attempt is refused like any other attempt on a reserved unit.
- **One client, several units**: allowed (see Assumptions). Each unit still has at most one active reservation.
- **Reserve right after expiry, before anyone opened the system**: the expired reservation is released first, then the new reservation succeeds. The unit is never treated as reserved by an expired reservation.
- **Two reps race for a unit whose reservation just expired**: the same rule as Story 1 applies: exactly one succeeds.
- **Price change race (phase 3)**: once a unit is reserved, a manager's price change on it is refused. This phase does not change that rule.
- **Unit or client id that does not exist, or has an invalid format**: an id with an invalid format is a validation error (400). A well-formed id that matches no record of the user's company is "not found" (404).
- **Client of another rep, or record of another company**: always "not found", so the request does not reveal that the record exists.
- **Reservation with a draft contract (phase 5)**: it still expires after 72 hours. A draft contract does not extend it.
- **Reservation with an approved contract (phase 5)**: it no longer counts as active in the lists, and its unit stays sold.
- **Cancel by hand**: no cancel action exists, for any role (out of scope).

## Requirements *(mandatory)*

### Functional Requirements

**Reserving**

- **FR-001**: Only a sales rep MUST be able to reserve a unit. A manager or an accountant who tries, even by calling the server directly, MUST be refused as "not allowed" (403), and nothing MUST change.
- **FR-002**: A sales rep MUST be able to reserve an available unit of their own company for a client they own. The request carries only the unit and the client.
- **FR-003**: A reservation MUST expire exactly 72 hours after the moment it is created, as recorded by the server. The expiry time, the sales rep, the company and the unit status MUST be set by the server; any such values sent by the user MUST be ignored.
- **FR-004**: A unit MUST have at most one active reservation at any time. A reservation request for a unit that is not available (already reserved by an active reservation, or sold) MUST be refused as a conflict (409) with one clear Arabic message saying the unit is no longer available because it was just reserved.
- **FR-005**: When two or more reservation requests for the same available unit arrive at the same moment, exactly one MUST succeed, and every other MUST be refused with the conflict in FR-004. This MUST hold under real concurrent requests, not only in sequence.
- **FR-006**: A sales rep MUST NOT be able to reserve for a client owned by another sales rep. Such a request MUST be refused as "not found" (404), the same answer as for a client that does not exist, so the client's existence is not revealed.
- **FR-007**: A unit or client of another company MUST be refused as "not found" (404). Every reservation MUST belong to the company of the logged-in rep, and its unit and client MUST belong to that same company.
- **FR-008**: Reserving MUST be all-or-nothing: the unit becomes reserved and the reservation is saved together, or neither happens. A refused request MUST leave the unit's status unchanged.
- **FR-009**: The server MUST validate the request. A missing or malformed unit or client id MUST be refused as a validation error (400) with the error shown next to the field.

**Expiry**

- **FR-010**: A reservation MUST count as active only while its expiry time is strictly in the future and no contract for it has been approved.
- **FR-011**: When a reservation expires and no contract was approved for it, its unit MUST become available again with no manual action and no scheduled job. Before the system shows units or reservations, and before it reserves a unit, it MUST first release every unit in the user's company whose reservations have all expired, so an expired reservation is never shown or treated as active.
- **FR-012**: A unit that was sold MUST never return to available, even after its reservation's time passes.
- **FR-013**: Expired reservations MUST be kept as history. They MUST NOT be deleted.
- **FR-014**: There MUST be no action, for any role, to cancel, shorten or extend a reservation by hand.

**Viewing reservations**

- **FR-015**: A sales rep MUST see only their own active reservations. A manager MUST see all active reservations of their own company. An accountant MUST be refused as "not allowed" (403) when asking for the reservations list.
- **FR-016**: Each listed reservation MUST show the unit's project name and number, the client's name, the expiry date and time in Saudi time (Asia/Riyadh), and the time left. The manager's view MUST also show the sales rep who made it.
- **FR-017**: The reservations list MUST be paged by the server (20 per page by default, at most 50), ordered by expiry time with the soonest first, with a stable order for equal expiry times so paging never repeats or skips a reservation. Paging parameters MUST be validated, and invalid values MUST be refused (400).
- **FR-018**: Reservations of another company MUST never appear in any list for any role.

**User interface**

- **FR-019**: The reserve action MUST be shown only to sales reps and only on available units. It MUST let the rep choose only among their own clients. If the rep has no clients, it MUST show a clear Arabic message with a link to add a client.
- **FR-020**: While a reservation request runs, the reserve button MUST show a loading state and MUST NOT be pressed again. A conflict (FR-004) MUST be shown as a message at the top of the form, and the unit's shown status MUST be refreshed so the rep sees it is no longer available.
- **FR-021**: After a successful reservation, the units list and the reservations list MUST show the new state without a manual page reload.
- **FR-022**: The reservations page MUST show a loading state, an empty state with a clear Arabic message, and an error state with a retry action.
- **FR-023**: The navigation MUST show the reservations section to managers and sales reps only, following the role map from phase 2.
- **FR-024**: All text MUST be in Arabic and laid out right-to-left. Pages MUST work on mobile and desktop.

**Proof (tests)**

- **FR-025**: Integration tests against a real database MUST prove each of the following:
  - two reservation requests for one unit sent in parallel, from two different reps each with their own client: exactly one succeeds, the other gets the conflict, exactly one reservation exists, and the unit is reserved;
  - an expired reservation makes the unit available again, and another rep can then reserve it;
  - a rep cannot reserve for another rep's client (404, no reservation, unit still available);
  - a user of company A cannot reserve a unit or for a client of company B (404), and a manager of company A never sees company B's reservations;
  - a manager and an accountant cannot reserve (403), and an accountant cannot list reservations (403).

### Permissions Summary

| Action | Manager | Sales rep | Accountant |
|---|---|---|---|
| Reserve a unit | No (403) | Yes, for own clients only | No (403) |
| See active reservations | All in own company | Own only | No (403) |
| Cancel, shorten or extend a reservation | No (no such action) | No (no such action) | No (no such action) |

### Key Entities *(include if feature involves data)*

- **Reservation** (exists since phase 1): a 72-hour hold on one unit for one client, made by one sales rep of the same company. Its expiry time is set to 72 hours after the moment it was created. It is active while its expiry time is in the future and no contract for it has been approved. Expired reservations stay as history.
- **Unit** (phase 3): its status goes from available to reserved when it is reserved, and back to available when its reservation expires with no approved contract. Only reservation, expiry and approval change it.
- **Client** (phase 3): owned by one sales rep. Only the owner can reserve units for this client.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In repeated runs of the parallel test (two reps reserving one unit at the same moment), 100% of runs end with exactly one success, one refusal, and one reservation for the unit.
- **SC-002**: 100% of reservations created have an expiry exactly 72 hours after their creation moment, whatever the request contains.
- **SC-003**: After a reservation's 72 hours pass with no approved contract, the unit is shown as available on the very next view by any user, with 0 manual steps.
- **SC-004**: 0 reservations can be created for another rep's client or for a unit or client of another company. Each such attempt returns "not found" and leaves the unit unchanged.
- **SC-005**: 0 reservations of another company appear in any reservations list, for any role.
- **SC-006**: A sales rep can reserve an available unit for one of their clients in under 30 seconds, starting from the units list.
- **SC-007**: The rep who loses a race sees, in Arabic and at the top of the form, that the unit was just reserved, and no error page or technical text is shown.
- **SC-008**: All integration tests in FR-025 pass on a fresh test database.

## Assumptions

- **One client, several reservations** (clarify focus in `docs/phases.md`): a client may hold active reservations on several different units at the same time. The brief does not limit it, and a buyer may compare units. Each unit still has at most one active reservation. To confirm in `/speckit-clarify`.
- **Where the rep sees reservations** (clarify focus in `docs/phases.md`): a "Reservations" page in the app navigation, for sales reps (own) and managers (whole company). The reserve action starts from the units list (and the unit page, if phase 3 has one). To confirm in `/speckit-clarify`.
- **Accountant**: has no reservations view, following the phase 2 navigation map. The accountant sees the reservation details they need on the contract page (phase 5).
- **"Active"**: expiry time strictly in the future and no approved contract. At the exact expiry moment the reservation is expired.
- **72 hours** are measured from the server's clock at the moment the reservation is saved, as an exact duration (not calendar days). The expiry is shown to users in Saudi time (Asia/Riyadh).
- **Status codes**: role not allowed → 403; another rep's client, or a unit or client of another company or that does not exist → 404; unit not available (lost the race, already reserved, or sold) → 409; invalid input → 400. One conflict message covers every "not available" case, because the rep cannot tell a fresh race from an older reservation, and both mean "pick another unit".
- **No reservation history page**: expired reservations are kept in the data but not listed in this phase.
- **No audit entry for reservations**: the brief's audit list (failed login, price change, contract approval, payment) does not include reservations.
- **Expiry is applied when data is read or changed**, not by a timer. The release step already exists from phase 3; this phase calls it before reserving and before listing reservations.
- **Draft contracts** do not extend a reservation. Approval of an expired reservation is refused in phase 5.
- **Cancelling** a reservation by hand is out of scope (user input). A rep who no longer needs a unit waits for the 72 hours to pass.
