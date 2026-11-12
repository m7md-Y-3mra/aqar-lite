# Feature Specification: Login, Logout and App Shell

**Feature Branch**: `claude/login-logout-app-shell-62f633`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Add login, logout and the app shell (see docs/brief.md sections 3.1 and 4). User stories: As a staff user, I log in with email and password and reach the app home page. As a staff user, I log out, and my session stops working on the server, not only in my browser. As a visitor who is not logged in, I am sent to the login page. API calls without a valid session get 401. Rules: There is no sign-up, no user management screen and no password reset. A wrong email and a wrong password show the same message. The response time must not reveal if the email exists. After 5 failed logins for one email within 15 minutes, login for that email is blocked for 15 minutes, with the same generic message. Every failed login is written to the audit log. The app shell is Arabic and RTL. It works on mobile and desktop. The navigation shows only items the user's role can use. A request that changes data and comes from another site is refused. Done when: A test proves logout makes the old session token unusable. A test proves the 6th failed login within 15 minutes is blocked. A test proves a POST with a foreign Origin is refused."

> **Note on this phase**: The attacker is a logged-in user or a hostile website (brief section 4), so security terms (session token, cookie, `Origin`, 401, 403) appear in the scenarios: they are the acceptance surface. Hashing method, libraries and code structure are left to the plan.

> **Dependency**: Builds on phase 1 (`002-schema-seed`, merged): users with one role and one company, sessions stored by token hash, the append-only audit log with the `LOGIN_FAILED` action, the per-email failed-login index, and the eight seed accounts. Builds on phase 0: the configured app origin (`APP_ORIGIN`), the route wrapper and the error codes. No schema change is expected in this phase.

## Clarifications

### Session 2026-11-12

- Q: How long does the login lock last, and do refused attempts during the lock extend it? → A: Rolling 15-minute window over wrong-credential failures only. Every failed login is audited with a reason: `invalid_credentials` (wrong email or password) or `locked` (refused because the email is locked). Only `invalid_credentials` rows count; `locked` rows never extend the lock. While locked, the submitted password is not verified, but the response is the same generic message with a similar response time. A test proves a user who retries with the correct password while locked can log in once the window passes.
- Q: Add a per-IP login limit as well as the per-email lock? → A: No, per-email lock only. README "Security" states that it does not stop password spraying across many accounts and lets anyone lock a known user out for 15 minutes. README "Not done" lists a per-IP limit behind a trusted proxy (IP only from that proxy's header) or a CAPTCHA after repeated failures, and explains why not now: under `docker compose` with no proxy the app sees the Docker gateway address for every user, so a per-IP limit would block everyone or trust a spoofable header.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log in and reach the home page (Priority: P1)

A staff member (manager, sales rep or accountant) opens the system, enters their email and password on an Arabic login page, and lands on the home page inside the app shell. The shell shows their name, role and company, and a navigation that lists only the sections their role can use.

**Why this priority**: Every later feature needs a logged-in user with a known company and role. Without login nothing else can be used or tested by hand.

**Independent Test**: With the seed data loaded, log in as each of the 8 seed accounts and confirm each reaches the home page showing the right name, role and company.

**Acceptance Scenarios**:

1. **Given** a seed account, **When** the user submits its correct email and password, **Then** they reach the home page, which shows their name, their role in Arabic and their company name.
2. **Given** a seed account, **When** the user types the email with different letter case or with spaces around it, **Then** login works the same as with the stored email.
3. **Given** the login form, **When** the user submits it with an empty email, a malformed email or an empty password, **Then** a validation message shows next to that field and no login attempt is made.
4. **Given** a logged-in user, **When** they open the login page, **Then** they are sent to the home page.
5. **Given** a logged-in user, **When** they close the browser and come back within 7 days, **Then** they are still logged in.
6. **Given** a logged-in user, **When** they look at the browser's script-readable storage and cookies, **Then** the session token is not readable by page scripts and is not in local or session storage.

---

### User Story 2 - Failed logins are generic, throttled and audited (Priority: P1)

Someone tries to log in with a wrong email or a wrong password. They always see the same message, the time the system takes does not tell them whether the email exists, every failure is written to the audit log, and after 5 failures for one email in 15 minutes the system refuses that email, even with the correct password, with the same message.

**Why this priority**: The brief requires protection against password guessing and a login error that does not reveal whether the email exists (section 4), and an audit of failed logins. These are security requirements, judged before features.

**Independent Test**: Against a test database, send 5 wrong-password logins for one seed email, then the correct password as the 6th attempt, and confirm the 6th is refused with the generic message, and that 6 failed-login audit rows exist for that email (5 `invalid_credentials`, 1 `locked`).

**Acceptance Scenarios**:

1. **Given** an email that exists, **When** a wrong password is submitted, **Then** the user sees the generic message "البريد الإلكتروني أو كلمة المرور غير صحيحة" at the top of the form and stays on the login page.
2. **Given** an email that does not exist, **When** any password is submitted, **Then** the user sees exactly the same message and the response has the same status and shape as for a wrong password.
3. **Given** an email that exists and an email that does not, **When** a wrong login is sent for each, **Then** both go through the same password-checking work, so their response times cannot be told apart.
4. **Given** any failed login (wrong email, wrong password or locked), **When** it finishes, **Then** one failed-login audit row exists with the tried email (trimmed and lowercased), the time and the reason (`invalid_credentials` or `locked`); for an existing account it also records the user and company. The password is never stored or logged.
5. **Given** 4 wrong-credential failures for one email in the last 15 minutes, **When** the correct password is submitted, **Then** login succeeds (the limit is not reached early).
6. **Given** 5 wrong-credential failures for one email in the last 15 minutes, **When** a 6th login is submitted with the correct password, **Then** it is refused with the same generic message, no session is created, and a failed-login audit row with reason `locked` is written.
7. **Given** an email locked by 5 wrong-credential failures, **When** the user keeps retrying with the correct password during the lock and then retries after 15 minutes have passed since the oldest of those 5 failures, **Then** the retries during the lock are refused and the retry after the window logs in; the refused retries did not extend the lock.
8. **Given** 5 wrong-credential failures for email A, **When** someone logs in to email B with the correct password, **Then** login succeeds; the lock applies to one email only.
9. **Given** failures sent with different letter case or spaces (`Ali@x.test`, ` ali@x.test `), **When** they are counted, **Then** they count as the same email.
10. **Given** an email that does not exist, **When** 5 wrong-credential failures are sent for it, **Then** the 6th is refused as locked the same way, so the lock does not reveal whether the email exists.

---

### User Story 3 - Logout ends the session on the server (Priority: P1)

A logged-in user clicks "تسجيل الخروج" in the app shell. They are sent to the login page, and the session is destroyed on the server: anyone who copied the old session token can no longer use it.

**Why this priority**: The brief requires that logout really invalidates the session on the server, not only by deleting the cookie (section 4). It is one of the three "done when" tests.

**Independent Test**: Log in, keep the raw session token, log out, then send a request to a protected API route with the old token and confirm it returns 401; open a protected page with the old token and confirm it goes to the login page.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they click "تسجيل الخروج", **Then** they reach the login page and the session cookie is removed from the browser.
2. **Given** a session token captured before logout, **When** it is sent to a protected API route after logout, **Then** the response is 401.
3. **Given** a session token captured before logout, **When** it is used to open a protected page after logout, **Then** the visitor is sent to the login page.
4. **Given** the same user logged in on two devices, **When** they log out on one, **Then** the other device's session still works.
5. **Given** a request to log out with no session or an invalid one, **When** it is sent, **Then** it finishes without error and the visitor ends on the login page.

---

### User Story 4 - Visitors without a session are kept out (Priority: P1)

A visitor who is not logged in, whose session expired, or who sends a made-up token opens any app page or calls any app API. Pages send them to the login page. API calls return 401 with a generic Arabic message and no data.

**Why this priority**: Every later feature relies on this gate. A single page or API route that works without a session is a data leak.

**Independent Test**: Without a cookie, with a random token and with an expired session, open the home page and call a protected API route; confirm the page goes to the login page and the API returns 401 each time.

**Acceptance Scenarios**:

1. **Given** no session cookie, **When** the visitor opens the home page or any other app page, **Then** they are sent to the login page.
2. **Given** no session cookie, a random token, or a token whose session expired more than 7 days after login, **When** a protected API route is called, **Then** the response is 401 with the generic message "يجب تسجيل الدخول" and no data.
3. **Given** a session older than 7 days, **When** it is used, **Then** it is treated as no session, even if the browser still sends the cookie.
4. **Given** the login page, **When** a visitor with no session opens it, **Then** it shows the login form (it is the only page reachable without a session).
5. **Given** any page, **When** a visitor looks for a sign-up, "forgot password" or user-management link, **Then** none exists.

---

### User Story 5 - Requests from other sites cannot change data (Priority: P1)

A hostile website makes the user's browser send a request that changes data (for example a hidden form that posts to the system) while the user is logged in. The system refuses the request before it does anything, because it does not come from the system's own origin. The same holds for the login request itself.

**Why this priority**: The brief assumes the system goes on the internet tomorrow. Cross-site request forgery would let any site act as the logged-in user. It is one of the three "done when" tests.

**Independent Test**: Send a POST to a mutating API route with a valid session and a foreign `Origin`, and confirm it is refused with 403 and nothing changes; send the same POST with the system's own origin and confirm it is accepted.

**Acceptance Scenarios**:

1. **Given** a valid session, **When** a POST, PUT, PATCH or DELETE arrives with an `Origin` that is not the system's configured origin, **Then** it is refused with 403 and a generic Arabic message, and nothing is changed.
2. **Given** a valid session, **When** the same request arrives with the system's own origin, **Then** it is processed normally.
3. **Given** a mutating request with no `Origin` header, **When** it arrives, **Then** it is refused with 403.
4. **Given** a login request with a foreign `Origin`, **When** it arrives, **Then** it is refused with 403, no session is created and no failed-login row is written.
5. **Given** a logout request with a foreign `Origin`, **When** it arrives, **Then** it is refused and the session still works (another site cannot log the user out).
6. **Given** a read-only request (GET), **When** it arrives from any origin, **Then** the origin check does not apply; the session check still does.

---

### User Story 6 - Arabic, responsive, role-aware app shell (Priority: P2)

Every logged-in page sits inside one app shell: a header with the system name, the user's name and role, a logout button, and a navigation. The whole interface is Arabic and right-to-left. On a phone the navigation folds into a menu button; on a large screen it is always visible. The navigation lists only the sections the user's role can use.

**Why this priority**: The brief requires an Arabic RTL interface that works on mobile and large screens (section 3.7). It frames every later page, but login and its security come first.

**Independent Test**: Log in as a manager, a sales rep and an accountant, at a phone width (375 px) and a desktop width (1280 px); confirm the layout is right-to-left, nothing overflows sideways, the menu opens and closes on the phone, and each role sees only its own navigation items.

**Acceptance Scenarios**:

1. **Given** any page, **When** it loads, **Then** the document language is Arabic, the direction is right-to-left, and all visible text is Arabic.
2. **Given** a phone-width screen, **When** a logged-in page loads, **Then** the navigation is behind a menu button, the page has no horizontal scroll, and the menu opens and closes by touch and by keyboard.
3. **Given** a desktop-width screen, **When** a logged-in page loads, **Then** the navigation is visible without opening a menu.
4. **Given** a user of role R, **When** the shell shows the navigation, **Then** it lists only the sections in the role map (FR-024) for role R whose pages exist, plus the home page.
5. **Given** the login page, **When** it loads on a phone or a desktop, **Then** it is usable at both widths and shows a loading state while the login request runs (the button cannot be pressed twice).
6. **Given** a login request that fails because of a server or network error, **When** it finishes, **Then** a generic Arabic error shows at the top of the form, distinct from the wrong-credentials message, and no detail is shown.

---

### Edge Cases

- **Correct password while locked**: refused with the generic message. Accepting it would let an attacker confirm a guess during the lock (Story 2, scenario 6).
- **Attempts continue during the lock**: each refused attempt is audited with reason `locked` but is not counted, so it never extends the lock. The lock ends 15 minutes after the oldest of the 5 most recent `invalid_credentials` failures. An attacker gets at most 5 password guesses per email per 15 minutes.
- **Lockout of a victim**: anyone who knows a user's email can lock that user out for 15 minutes by sending 5 wrong passwords. Accepted for this test (see Assumptions).
- **Successful login does not reset the count**: 4 failures, a success, then 1 more failure within 15 minutes locks the email for the next attempt. The audit log has no "login succeeded" action to reset from.
- **Very long input**: an email or password above the maximum length (FR-005) is refused as invalid input before any password check, so huge inputs cannot burn server time.
- **Locked email that does not exist**: locked the same way as a real one (Story 2, scenario 10).
- **Expired session cookie still in the browser**: treated as no session (Story 4, scenario 3).
- **Tampered or random token**: treated as no session; the response does not say whether a token was malformed, unknown or expired.
- **Logout twice / logout without session**: succeeds silently and ends on the login page (Story 3, scenario 5).
- **Missing `Origin` on a mutating request**: refused (Story 5, scenario 3). Browsers always send it on POST from pages; only hand-made requests lack it.
- **Reached through another host name**: the origin check compares with the one configured origin. Opening the app through `127.0.0.1` or a LAN address instead of the configured origin makes mutating requests fail (see Assumptions).
- **Login request while the database is down**: generic server-error message; details only in the server log.
- **Redirect after login**: always to the home page. The system never takes a return address from the request, so it cannot be used to send users to another site.
- **Password and token in logs**: never written to any log, error message or response, including on server errors during login.

## Requirements *(mandatory)*

### Functional Requirements

**Login**

- **FR-001**: The system MUST provide a login page with an email field and a password field, in Arabic. It is the only page reachable without a session.
- **FR-002**: The system MUST NOT provide self sign-up, a user management screen or password reset, and MUST NOT show links to them.
- **FR-003**: The system MUST normalize the submitted email (trim spaces, lowercase) before looking up the user and before counting failures.
- **FR-004**: On a correct email and password for an email that is not locked, the system MUST create a new session and send the user to the home page. The home page MUST be the only destination after login; no return address is read from the request.
- **FR-005**: The system MUST validate login input on the server: email required, valid email format, at most 254 characters; password required, at most 128 characters. Invalid input MUST return field errors shown next to each field, and MUST NOT count as a failed login or write an audit row.
- **FR-006**: Every login failure for valid input — unknown email, wrong password, or locked email — MUST return the same response status, the same response shape and the same Arabic message: "البريد الإلكتروني أو كلمة المرور غير صحيحة".
- **FR-007**: Every login failure path MUST take a similar response time, so the time does not reveal whether the email exists or is locked. An unknown email is checked against a dummy password hash. A locked email MUST NOT have the submitted password verified against the account, but MUST do equivalent dummy hashing work so its response time matches the other paths.
- **FR-008**: Before checking the password, the system MUST count the failed-login audit rows with reason `invalid_credentials` for the normalized email in the last 15 minutes. If there are 5 or more, the email is locked: the login MUST be refused with the generic message, even when the password is correct. Rows with reason `locked` MUST NOT be counted.
- **FR-009**: Every failed login MUST write one failed-login audit row with the normalized email, the time, the user and company when the email belongs to an account, and a reason: `invalid_credentials` for an unknown email or a wrong password, `locked` for an attempt refused because the email is locked.
- **FR-010**: Passwords MUST never appear in any log, audit row, response or error message.

**Sessions**

- **FR-011**: A session MUST be identified by a long random secret token generated by the server. The server MUST store only a one-way hash of the token, never the raw token.
- **FR-012**: A session MUST expire exactly 7 days after login. The expiry MUST NOT be extended by activity. An expired session MUST be treated as no session.
- **FR-013**: The session token MUST be sent to the browser only in a cookie that page scripts cannot read, that is sent only over secure connections, and that is not sent on cross-site sub-requests (same-site "lax" policy). The token MUST NOT be placed in browser storage, in a URL or in a response body.
- **FR-014**: A user MAY have several active sessions (several devices). Each login creates a new session.
- **FR-015**: The user's company and role MUST be read from the stored user linked to the session on every request, never from the request itself.

**Logout**

- **FR-016**: Logout MUST delete the current session on the server and clear the session cookie, then send the user to the login page.
- **FR-017**: After logout, the old token MUST be refused everywhere: protected API routes return 401 and protected pages go to the login page.
- **FR-018**: Logout MUST end only the current session; other sessions of the same user keep working.
- **FR-019**: Logout with no session or an invalid session MUST succeed without error.

**Access gate**

- **FR-020**: Every app page except the login page MUST check the session on the server before it renders. Without a valid session, the visitor MUST be sent to the login page.
- **FR-021**: Every API route except login MUST check the session on the server. Without a valid session, it MUST return 401 with the generic message "يجب تسجيل الدخول" and no data. The response MUST NOT say whether the token was missing, unknown or expired.
- **FR-022**: A logged-in user who opens the login page MUST be sent to the home page.

**Cross-site request protection**

- **FR-023**: Every API request that can change data (POST, PUT, PATCH, DELETE), including login and logout, MUST be refused with 403 and a generic Arabic message, before any other work, when its `Origin` header is missing or is not exactly the system's configured origin. Read-only requests are not subject to this check.

**App shell**

- **FR-024**: The navigation MUST show only the sections allowed for the user's role, from this role map (later phases may refine it when they add the section):

  | Section | Manager | Sales rep | Accountant |
  |---|---|---|---|
  | Home | ✓ | ✓ | ✓ |
  | Units | ✓ | ✓ | |
  | Clients | ✓ | ✓ | |
  | Reservations | ✓ | ✓ | |
  | Contracts | ✓ | ✓ | ✓ |
  | Audit log | ✓ | | |

  A section MUST appear only once its page exists, so the navigation never links to a missing page. In this phase only Home exists.
- **FR-025**: The navigation map is a convenience, not a permission check. Every later page and API route MUST still check role and ownership on the server.
- **FR-026**: The shell MUST show the system name, the user's name, the user's role in Arabic (مدير، مندوب مبيعات، محاسب) and the company name, and a logout button.
- **FR-027**: The home page MUST show a short welcome with the user's name, role and company only. It MUST NOT show statistics or summaries (a dashboard is out of scope).
- **FR-028**: Every page MUST be Arabic and right-to-left, and MUST work without horizontal scrolling from 360 px to 1920 px wide. Below desktop width the navigation MUST fold into a menu that works by touch and by keyboard.
- **FR-029**: The login form MUST show a loading state while the request runs and block a second submit; show field errors next to the field; and show the generic credentials message or a generic server-error message at the top of the form.

**Errors and logging**

- **FR-030**: Unexpected errors during login, logout or the session check MUST return a generic Arabic message. Details go only to the server log, which MUST NOT contain passwords, raw tokens or cookie values.

**Tests**

- **FR-031**: Integration tests against a real database MUST prove:
  1. After logout, a request to a protected API route with the raw token kept from before logout returns 401.
  2. After 5 wrong-credential failures for one email within 15 minutes, a 6th login with the **correct** password is refused with the generic message and writes a `locked` row, and after only 4 failures the correct password succeeds.
  3. A user who retries with the correct password while locked (each retry refused and written as `locked`) can log in once 15 minutes have passed since the oldest of the 5 failures; the `locked` retries do not extend the lock.
  4. A POST with a foreign `Origin` is refused with 403 and changes nothing, a POST with no `Origin` is refused, and the same POST with the system's own origin is accepted.
  5. An unknown email and a wrong password return the same status, shape and message, and each writes one `invalid_credentials` audit row.
  6. A protected API route returns 401 with no cookie, with a random token and with an expired session.

### Key Entities

- **User** (from phase 1): a staff member with one company and one role. Login reads the email, password hash, role, name and company.
- **Session** (from phase 1): one login of one user on one device. Stored by the hash of its token, with a fixed expiry 7 days after creation. Deleted on logout.
- **Audit Log — failed login** (from phase 1): one row per failed login, with the normalized email, the time, the reason (`invalid_credentials` or `locked`), and the user and company when the email is known. Never changed or deleted. Its `invalid_credentials` rows are the source for the lock count.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the 8 seed accounts can log in from the README credentials and reach the home page in under 1 minute, on a phone and on a desktop.
- **SC-002**: After logout, 100% of requests that reuse the old session token are refused (401 for API routes, login page for pages).
- **SC-003**: For one email, the 6th login within 15 minutes after 5 wrong-credential failures is refused in 100% of runs, even with the correct password, and the 5th attempt is never refused as locked early.
- **SC-004**: 100% of mutating requests with a foreign or missing origin are refused without changing any data; 100% of the same requests from the system's own origin are accepted.
- **SC-005**: A wrong email and a wrong password give identical messages and statuses in 100% of attempts, and over 20 attempts of each their average response times differ by less than 20% (manual check; not an automated test, to avoid flaky timing in CI).
- **SC-006**: 100% of failed logins (wrong email, wrong password, locked) produce exactly one failed-login audit row, and 0 log lines or audit rows contain a password or a raw token.
- **SC-007**: 0 app pages other than the login page render content without a valid session, and 0 API routes other than login return data without one.
- **SC-008**: At 375 px and 1280 px widths, every page of this phase has no horizontal scroll, is right-to-left, and shows each role only its allowed navigation items.

## Assumptions

- **Lock window** (confirmed in Clarifications): the lock is computed from the failed-login audit rows: login is refused while the normalized email has 5 or more `invalid_credentials` failures in the last 15 minutes. Refused attempts are audited as `locked` and never counted, so they never extend the lock; it ends 15 minutes after the oldest of the 5 most recent wrong-credential failures. With 5 quick failures this equals "blocked for 15 minutes". The README "Assumptions" section states this rule.
- **No reset on success**: a successful login does not clear earlier failures, because the audit log has only failure events. A user with 4 typos, then a success, then 1 typo within 15 minutes is locked out. Accepted for simplicity.
- **Victim lockout and no per-address limit**: the lock is per email only (confirmed in Clarifications). Anyone can lock a known email for 15 minutes, and one attacker can spray a few passwords across many emails; both risks are stated in the README "Security" section. A per-IP limit behind a trusted proxy, or a CAPTCHA after repeated failures, is listed in README "Not done" with the reason it is not built: without a proxy the app sees one Docker gateway address for every user, so a per-IP limit would block everyone or trust a spoofable header. No per-IP limit and no CAPTCHA are built in this phase.
- **Session lifetime**: fixed 7 days from login, no sliding renewal and no "remember me" choice. Sessions are not ended when a password changes, because passwords cannot change in this system.
- **Supported address**: the system is reached at the configured origin (`http://localhost:3000` in the default compose setup). Browsers treat `localhost` as a secure context, so the secure-only cookie works there over plain HTTP. Opening it through another host name (such as `127.0.0.1`) is not supported, because the origin check compares with the one configured origin. The README states this.
- **Missing `Origin`**: refused for mutating requests. Every current browser sends `Origin` on POST, PUT, PATCH and DELETE from a page, so real users are not affected.
- **Navigation map**: the role map in FR-024 follows the brief's role table: the manager sees everything in the company and the audit log; the sales rep works with units, own clients, own reservations and own draft contracts; the accountant works with contracts and payments (payments live inside the contract page). Later phases may adjust it and must keep server checks either way.
- **Expired session cleanup**: expired sessions are refused on use; deleting old expired rows in the background is not needed (no scheduled jobs in this system).
- **Failed-login reason**: the audit row records `invalid_credentials` or `locked`. Only `invalid_credentials` counts toward the lock; `locked` rows exist so every failed login is audited (brief section 4) and so a reviewer can see attacks during a lock.
- **Home page**: a welcome page only, not a dashboard (out of scope in the brief).
