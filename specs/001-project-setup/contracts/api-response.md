# Contract: API Response Envelope and Route Wrapper

Every `/api/**` route handler is built with `handleRoute()` from `src/server/http/route-handler.ts`.
Feature `<f>.routes.ts` files use it; `src/app/api/**/route.ts` only re-exports them.

## Success

```json
{ "data": <JSON-safe DTO> }
```

Status `200` by default (a handler may return `201`). DTOs hold integers and ISO date strings only, never `BigInt` or `Date`.

## Error

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "<Arabic text>", "fieldErrors": { "name": ["..."] } } }
```

`fieldErrors` appears only for `VALIDATION_ERROR`.

## Phase 0 error codes

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `ZodError` from parsing body/query/params, or a body that is not valid JSON |
| `UNAUTHORIZED` | 401 | route has `auth: "user"` and there is no valid session (**always** in phase 0: fail closed) |
| `FORBIDDEN` | 403 | `AppError("FORBIDDEN")` thrown by a service |
| `INVALID_ORIGIN` | 403 | POST/PUT/PATCH/DELETE whose `Origin` header is missing or not equal to `APP_ORIGIN` |
| `NOT_FOUND` | 404 | `AppError("NOT_FOUND")` (also used for another company's records from phase 3 on) |
| `INTERNAL_ERROR` | 500 | any error that is not an `AppError` or `ZodError` |

## Wrapper order of checks

1. Mutating method → Origin check → `INVALID_ORIGIN`.
2. `auth: "user"` → session check → `UNAUTHORIZED`.
3. Run the handler.
4. Map thrown errors as in the table above.

## Logging rule

`INTERNAL_ERROR` responses carry only the generic Arabic message. The original error (message, stack)
goes to the pino logger with the request method and path. Bodies, cookies and headers are not logged raw; redaction is in `src/server/logger.ts`.
