# Quickstart: Login, Logout and App Shell

**Feature**: `003-auth-app-shell`

How to prove this phase works. Details live in [contracts/api-auth.md](./contracts/api-auth.md),
[contracts/ui-shell.md](./contracts/ui-shell.md) and [data-model.md](./data-model.md).

## 1. Automated checks

```bash
docker compose up -d db
```

```bash
npm run lint && npm run typecheck && npm run test && npm run test:integration
```

Expected: everything passes. The integration tests that carry the "done when" items:

| Test file | Proves |
|---|---|
| `tests/integration/features/auth/logout.test.ts` | The raw token kept from before logout gets 401 on `GET /api/auth/me` afterwards; another session of the same user still works; logout with no session returns 200 |
| `tests/integration/features/auth/login-lock.test.ts` | 5 `invalid_credentials` → the 6th, with the **correct** password, gets 401 and writes `locked`; 4 failures → the correct password succeeds; 5+ `locked` retries during the lock, then time moves past the window (fake `Date`) → success; 8 parallel wrong attempts → exactly 5 `invalid_credentials` + 3 `locked`; an unknown email locks the same way; case and space variants count as one email |
| `tests/integration/features/auth/origin.test.ts` | Login POST with a foreign `Origin` → 403, no session, no audit row; no `Origin` → 403; logout with a foreign `Origin` → 403 and the session still works; the same requests with `APP_ORIGIN` succeed |
| `tests/integration/features/auth/login.test.ts` | A correct login sets the cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=604800` and creates one session whose id is the token's SHA-256; an unknown email and a wrong password give identical bodies and one `invalid_credentials` row each; invalid input → 400 + `fieldErrors` + no audit row; no password or token in any audit row |
| `tests/integration/features/auth/login-errors.test.ts` | A forced repository error during login gives 500 with the generic message, no cookie, no session, and the server log holds neither the password nor the token |
| `tests/integration/server/auth/session-gate.test.ts` | `GET /api/auth/me` → identical 401 with no cookie, a random token, and an expired session (fixture row with `expires_at` in the past) |
| `tests/integration/prisma/schema-constraints.test.ts` (added case) | A `LOGIN_FAILED` row with a reason other than `invalid_credentials` or `locked` is refused by the database |

## 2. Run the app

```bash
docker compose up
```

Open `http://localhost:3000`. Seed accounts and the password are in the README "Running" section.

| Step | Expected |
|---|---|
| Open `/` with no session | Redirect to `/login` |
| Log in as `manager@ufuq.test` | Home: "مرحبًا، …", role "مدير", company "شركة الأفق للتطوير العقاري" |
| Open `/login` again | Redirect to `/` |
| DevTools → Application → Cookies | `aqar_session` is `HttpOnly`, `Secure`, `SameSite=Lax`; Local/Session Storage hold no token |
| Click "تسجيل الخروج" | `/login`; the cookie is gone |
| Wrong password 5 times, then the correct one | All 6 show "البريد الإلكتروني أو كلمة المرور غير صحيحة" |
| Log in as each of the 8 seed accounts (another email than the locked one) | Each reaches home with the right role and company |

## 3. Origin check by hand

```bash
curl -i -X POST http://localhost:3000/api/auth/login -H 'Origin: https://evil.test' -H 'Content-Type: application/json' -d '{"email":"manager@ufuq.test","password":"x"}'
```

Expected: `403` with code `INVALID_ORIGIN`, and no new `LOGIN_FAILED` row.

## 4. Layout checks (manual)

- DevTools device mode at 375 px and 1280 px, logged in as manager, sales rep and accountant: right-to-left, no
  horizontal scroll, Home is the only navigation item.
- At 375 px the menu button opens and closes the navigation by click, Enter/Space and Escape.
- The login page at 375 px: the fields and button fit; the button is disabled while the request runs.

## 5. Browser cookie check (manual, record the result)

Log in at `http://localhost:3000` in **Chrome**, **Firefox** and, if available, **Safari**. Record in the README
which browsers keep the `Secure` cookie on `http://localhost`. If one does not, stop and ask the user before
changing anything (research R2).

## 6. Timing check (manual, SC-005)

Send 20 logins with unknown emails and 20 with a known email and a wrong password. Spread the known-email
attempts over the 8 seed accounts, at most 4 each, so the lock does not trigger. The average times should differ by less than 20%. This is not part of CI.
