# Contract: Auth API

**Feature**: `003-auth-app-shell`

All responses use the phase 0 shape: `{ data }` or `{ error: { code, message, fieldErrors? } }`.
Mutating requests (POST) pass the origin check first: `Origin` must equal one entry of `APP_ORIGIN` exactly, or
the response is `403 INVALID_ORIGIN` and nothing else runs. `APP_ORIGIN` is a comma-separated list; the shipped value
is `http://localhost:3000,http://127.0.0.1:3000`. No wildcards or prefix matches; a missing `Origin` is refused.

Session cookie: `aqar_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
Clearing: the same attributes with an empty value and `Max-Age=0`.

## Error codes added

| Code | Status | Arabic message |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | البريد الإلكتروني أو كلمة المرور غير صحيحة |

Existing codes used: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401 ("يجب تسجيل الدخول أولاً"), `INVALID_ORIGIN` 403,
`INTERNAL_ERROR` 500.

## `POST /api/auth/login` (public)

**Request body**: `{ "email": string, "password": string }`. Rules: [data-model.md](../data-model.md) "Login
input". Other keys are ignored.

| Case | Status | Body | Cookie | Audit row |
|---|---|---|---|---|
| Foreign or missing `Origin` | 403 | `INVALID_ORIGIN` | none | none |
| Body not JSON, or a field invalid | 400 | `VALIDATION_ERROR` + `fieldErrors` | none | none |
| Unknown email | 401 | `INVALID_CREDENTIALS` | none | `invalid_credentials`, no user/company |
| Wrong password | 401 | `INVALID_CREDENTIALS` | none | `invalid_credentials` + user + company |
| Email locked (≥ 5 `invalid_credentials` in 15 min), any password | 401 | `INVALID_CREDENTIALS` | none | `locked` (+ user + company if known) |
| Correct, not locked | 200 | `{ data: { name, role, companyName } }` | set | none |
| Unexpected error | 500 | `INTERNAL_ERROR` | none | none (details only in the log) |

- The three 401 cases have the **same** status, code, message and body shape.
- Unknown and locked emails run one dummy password verify, so all failure paths do the same hashing work.
- A successful login does not end the user's other sessions.
- The response body never contains the token, the password hash or any id.

## `POST /api/auth/logout` (public)

No body.

| Case | Status | Body | Effect |
|---|---|---|---|
| Foreign or missing `Origin` | 403 | `INVALID_ORIGIN` | nothing; the session keeps working |
| Valid session cookie | 200 | `{ data: { ok: true } }` | session row deleted; cookie cleared |
| No cookie, unknown or expired token | 200 | `{ data: { ok: true } }` | cookie cleared; nothing else |

After logout the old token gets `401 UNAUTHORIZED` on every `auth: "user"` route, and pages send it to `/login`.

## `GET /api/auth/me` (user)

| Case | Status | Body |
|---|---|---|
| Valid session | 200 | `{ data: { name, role, companyName } }` |
| No cookie, random token, logged-out token, or expired session | 401 | `UNAUTHORIZED`, identical for every case |

## Route wrapper change (`handleRoute`)

- `auth: "user"`: the wrapper reads `aqar_session` from the `Cookie` header and resolves `SessionUser` (session
  joined to user and company, `expires_at > now`). Missing → `401 UNAUTHORIZED`. The user is passed to the handler:
  `handler(req, ctx, user)`.
- Order: origin check (mutating methods) → session check → Zod parse → service.
- `auth: "public"`: unchanged.

## Page gate

| Page | No valid session | Valid session |
|---|---|---|
| `/login` | Login form | Redirect to `/` |
| `/` and every page in the `(app)` group | Redirect to `/login` | Render inside the shell |
