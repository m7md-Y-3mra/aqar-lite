# Contract: Environment Variables

The app reads these, validated by `src/server/env.ts`. `.env.example` lists exactly these keys
(a unit test compares the two). Compose supplies local development values, so a clean clone needs no `.env`.

| Variable | Required | Rule | Compose value (local dev only, not secret) |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://` or `postgres://` URL | `postgresql://aqar:aqar@db:5432/aqar` |
| `APP_ORIGIN` | yes | `http(s)://host[:port]`, no path; the only `Origin` allowed on mutating requests | `http://localhost:3000` |
| `LOG_LEVEL` | no (default `info`) | one of `fatal error warn info debug trace silent` | `info` |

Used only by tooling, not by the app (not in the app schema):

| Variable | Used by | Default |
|---|---|---|
| `TEST_DATABASE_URL` | `vitest.integration.config.ts` | `postgresql://aqar:aqar@localhost:5433/aqar_test` |
| `DB_HOST_PORT` | `docker-compose.yml` (host port for `db`, bound to `127.0.0.1`) | `5433` |

## Failure output (example)

```text
Invalid environment configuration. The app will not start.
  - DATABASE_URL: missing
  - APP_ORIGIN: must be an origin like https://example.com (no path)
Set these variables (see .env.example) and start again.
```

Exit code `1`. Values are never printed.
