# API: Audit Log

## `GET /api/audit-log`

Lists the session company's audit events, newest first. Read only: the route file exports `GET` only.

**Auth**: session cookie (`handleRoute({ auth: "user" })`). Role `MANAGER` only (checked in the service).

**Query** (all optional):

| Name | Rule | Default |
|---|---|---|
| `page` | integer 1 … 100,000 | 1 |
| `pageSize` | integer 1 … 50 | 20 |

Any other query key is ignored. The company always comes from the session.

**200**

```json
{
  "data": {
    "items": [
      {
        "id": "…",
        "createdAt": "2026-11-13T09:15:02.123Z",
        "actorName": "محاسب الأفق",
        "action": "PAYMENT_RECORDED",
        "details": {
          "contractId": "…",
          "amount": 1500000,
          "allocation": [{ "seq": 0, "applied": 1000000 }, { "seq": 1, "applied": 500000 }],
          "remainingAfter": 8500000
        }
      },
      {
        "id": "…",
        "createdAt": "2026-11-13T09:10:00.000Z",
        "actorName": null,
        "action": "LOGIN_FAILED",
        "details": { "email": "sales1@ufuq.test", "reason": "invalid_credentials" }
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  }
}
```

The `details` shape per action is in [data-model.md](../data-model.md). `details` is `null` when the stored details
do not match their schema.

**Errors** (shape `{ error: { code, message, fieldErrors? } }`, Arabic messages):

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `page` or `pageSize` invalid (`fieldErrors.page` / `fieldErrors.pageSize`) |
| 401 | `UNAUTHORIZED` | no valid session |
| 403 | `FORBIDDEN` | role is `SALES` or `ACCOUNTANT` |
| 500 | `INTERNAL_ERROR` | unexpected; generic message, details only in the log |

No `POST`, `PUT`, `PATCH` or `DELETE`. Next.js answers 405 for them.

## Page: `/audit-log`

`requireUser()`; any role but `MANAGER` → `redirect("/")`. The page prefetches `auditLogKeys.list(query)` with
`listAuditLog` (same key and DTO as the API) and hydrates the client list.
