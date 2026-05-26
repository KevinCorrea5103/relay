# Integration tests

Plain-`node` scripts. No framework, no magic. Each file is self-contained
and exits non-zero on failure so CI just runs them in sequence.

## What's covered

| File | What it verifies |
|---|---|
| `01-broker.mjs`       | NATS-backed custom-tools broker (wait/resolve, cross-instance, timeout) |
| `02-security.mjs`     | RLS isolation, API key rotation, audit log, master-key envelope rotation |
| `03-scale.mjs`        | RLS via the `relay_app` role, rate limiter (memory + Redis), ClickHouse mirror |
| `04-composition.mjs`  | JSON-schema validation, run linking, workflow trees, cost aggregation, voice surface |
| `05-graph.mjs`        | Graph runner: linear / conditional / cycles / async / validation |

## Running locally

```bash
# bring everything up
pnpm db:up                       # postgres
docker compose up -d nats redis clickhouse
pnpm db:migrate

# set up the relay_app role (one-time, idempotent)
psql "$DATABASE_URL" -c "ALTER ROLE relay_app WITH PASSWORD 'relay_app';"

# apply the ClickHouse schema
docker exec -i relay-clickhouse \
  clickhouse-client --user relay --password relay --database relay --multiquery \
  < migrations/clickhouse/001_events.sql

# build deps then run every test
pnpm --filter @relayhq/db build
pnpm --filter @relayhq/control-plane build
pnpm --filter @relayhq/sdk build

node tests/integration/run-all.mjs
```

Each script reads `DATABASE_URL`, `DATABASE_URL_APP`, `NATS_URL`,
`REDIS_URL`, `CLICKHOUSE_URL` from env. `run-all.mjs` sets sensible
defaults for the docker-compose stack.

## In CI

`.github/workflows/ci-integration.yml` spins up the same services and
runs `run-all.mjs`. No fixtures shipped — every test seeds and tears
down its own data.
