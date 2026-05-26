# Production deploy runbook — security + scale rollout

Sequence to apply to the live `relayhq-api` (Fly) + Supabase Postgres setup.
Every step is independently rollback-able. Stop and check before moving on.

> **You drive the deploys** (Fly tokens, Supabase password, Upstash account
> credentials). The Claude session prepared all the code and infra config;
> nothing here changes prod without your hands.

---

## Step 0 — Snapshot prod state (10 min)

Before anything, take a clean restore point.

```bash
# Manual snapshot in Supabase dashboard:
#   Project → Database → Backups → "Backup now"
# Wait until it finishes (~2 min) and copy the snapshot ID.

# Take a sanity dump locally too (defense against Supabase outages):
pg_dump "$SUPABASE_URL" --no-owner --no-privileges \
  --format=custom --file=relay-prod-$(date +%Y%m%d-%H%M).dump
```

Restore plan if anything below goes sideways:
- Postgres: restore the dashboard snapshot.
- Fly: `fly deploy --image $PREV_IMAGE` (image ref in Fly dashboard).

---

## Step 1 — Apply migration 004 to Supabase (5 min)

The migration is idempotent and **does not break existing code** — RLS
policies allow all rows when the `app.tenant_id` GUC is unset and the
caller is the table owner (which the current control-plane connection
is). It only **enables** RLS for the future `relay_app` role.

```bash
# From repo root, with DATABASE_URL pointed at Supabase:
DATABASE_URL="postgres://postgres:$PROD_PWD@db.xxxxx.supabase.co:5432/postgres" \
  pnpm db:migrate
# Should print: [migrate] apply 004_security.sql
#               [migrate] done
```

Verify in Supabase SQL editor:
```sql
select table_name, row_security
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('runs','run_events','memories',
                      'provider_credentials','api_keys','audit_events');
-- All should have row_security = 'YES'.

select rolname from pg_roles where rolname = 'relay_app';
-- Should return one row.
```

**Verify the app still works**: hit `https://api.relaygh.dev/v1/runs` with
your existing API key. It must return 200 (because the control plane
still connects as the owner role and bypasses RLS).

If anything is broken: nothing to roll back — the migration is purely
additive. Code did not change yet.

---

## Step 2 — Create the `relay_app` Supabase user (5 min)

Supabase doesn't expose `relay_app` automatically. Either:

**Option A** — use the user the migration created (`relay_app`), set its
password yourself:
```sql
alter role relay_app with password '<long-random-password>';
```
Then the connection string is:
```
postgres://relay_app:<password>@db.xxxxx.supabase.co:5432/postgres
```

**Option B** — keep using the dashboard's pre-made roles. In that case,
grant the same privileges + RLS-applicability to a new role you create
in the Supabase dashboard.

Test the new user can ONLY see rows when `app.tenant_id` is set:
```bash
psql "$APP_URL" -c "select count(*) from tenants;"
# Should be 0 (RLS hides everything without app.tenant_id)

psql "$APP_URL" -c "set local app.tenant_id = '<some_tenant_uuid>';
                    select count(*) from runs;"
# Should be that tenant's run count.
```

---

## Step 3 — Deploy code with DATABASE_URL_APP (10 min)

Wire the new env var in Fly secrets:
```bash
fly secrets set --app relayhq-api \
  DATABASE_URL_APP="postgres://relay_app:<password>@db.xxxxx.supabase.co:5432/postgres"
```

Build + deploy:
```bash
pnpm build
fly deploy --app relayhq-api
```

Watch logs:
```bash
fly logs --app relayhq-api
# Expect:
#   [control-plane] listening on http://...
#   [control-plane] tool broker: memory (...)
#   [control-plane] rate-limit backend: memory (...)
#   [control-plane] clickhouse mirror: off
```

**Smoke test** (use your existing key):
```bash
curl -H "Authorization: Bearer $RELAY_API_KEY" \
     https://api.relaygh.dev/v1/audit
# Should return your tenant's audit log.

curl -H "Authorization: Bearer $RELAY_API_KEY" \
     https://api.relaygh.dev/v1/keys
# Should return only YOUR keys.
```

This step is also rollback-safe: if anything looks off, revert the deploy.

---

## Step 4 — NATS on Fly (15 min)

```bash
# Create a tiny Fly app for NATS:
mkdir -p infra/nats && cd infra/nats
cat > fly.toml <<'EOF'
app = "relayhq-nats"
primary_region = "gru"

[build]
  image = "nats:2.10-alpine"

[experimental]
  cmd = ["-js", "-sd", "/data", "-m", "8222"]

[mounts]
  source = "nats_data"
  destination = "/data"

[[services]]
  protocol = "tcp"
  internal_port = 4222
  [[services.ports]]
    port = 4222

[[services]]
  protocol = "tcp"
  internal_port = 8222
  [[services.ports]]
    port = 8222
EOF

fly apps create relayhq-nats
fly volumes create nats_data --region gru --size 3 --app relayhq-nats
fly deploy --app relayhq-nats --primary-region gru

# Get the internal hostname (Fly private network):
# nats://relayhq-nats.internal:4222
```

Wire it to the control plane:
```bash
fly secrets set --app relayhq-api NATS_URL="nats://relayhq-nats.internal:4222"
fly deploy --app relayhq-api
# Logs should now read:
#   [control-plane] tool broker: nats
```

**Now you can scale horizontally:**
```bash
fly scale count 3 --app relayhq-api
```

---

## Step 5 — Redis on Upstash (10 min)

Easier than self-hosting; free tier covers 10k requests/day which is fine
to start.

1. Sign up at upstash.com → create Redis database in region close to Fly
   (us-east-1 if `gru` is too far; check latency).
2. Copy the connection string `rediss://default:<pw>@host:port`.
3. ```bash
   fly secrets set --app relayhq-api REDIS_URL="rediss://default:<pw>@host:port"
   fly deploy --app relayhq-api
   # Logs:
   #   [control-plane] rate-limit backend: redis
   ```

Test rate limit:
```bash
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" \
       -H "Authorization: Bearer $RELAY_API_KEY" \
       https://api.relaygh.dev/v1/audit
done
# Expect: 60 × 200, then 429 with Retry-After header
```

---

## Step 6 — ClickHouse (30 min, do AFTER everything above is stable)

Easiest: **ClickHouse Cloud** (~$200/mo entry, managed) or **Aiven**
(similar). Self-hosting requires more ops attention.

```bash
# Once you have a CLICKHOUSE_URL:
# 1. Apply the schema:
clickhouse-client \
  --host="$CH_HOST" --port=9440 --secure \
  --user="$CH_USER" --password="$CH_PWD" \
  --queries-file=migrations/clickhouse/001_events.sql

# 2. Wire the secret (double-write mode):
fly secrets set --app relayhq-api \
  CLICKHOUSE_URL="https://relay:$CH_PWD@$CH_HOST:8443/relay"
fly deploy --app relayhq-api
# Logs:
#   [control-plane] clickhouse mirror: on (double-write only, reading from Postgres)
```

**Verify double-write works (run for ~7 days)**:
```sql
-- Postgres:
SELECT COUNT(*) FROM run_events WHERE ts > now() - INTERVAL '1 hour';

-- ClickHouse:
SELECT COUNT(*) FROM run_events WHERE ts > now() - INTERVAL 1 HOUR;

-- The two should match within ~5% (ClickHouse buffering window).
```

**Flip reads (only when counts match consistently)**:
```bash
fly secrets set --app relayhq-api READ_EVENTS_FROM=clickhouse
fly deploy --app relayhq-api
```

**Drop Postgres run_events (only after a week reading from ClickHouse)**:
```sql
-- Backup first:
\copy (select * from run_events) to 'run_events_backup.csv' csv header;
-- Then:
drop table run_events;
```

---

## Step 7 — Master key rotation (when needed, ~5 min)

Every 90 days, or immediately if you suspect compromise.

```bash
# Local: generate the new key
NEW_KEY=$(pnpm db:keygen | tail -1)

# Set both env vars: old becomes previous, new becomes primary
fly secrets set --app relayhq-api \
  RELAY_MASTER_KEY="$NEW_KEY" \
  RELAY_MASTER_KEY_PREVIOUS="$CURRENT_MASTER_KEY"
fly deploy --app relayhq-api
# Now new writes use NEW; old reads still work via PREVIOUS.

# Re-encrypt all existing rows:
RELAY_MASTER_KEY="$NEW_KEY" \
RELAY_MASTER_KEY_PREVIOUS="$CURRENT_MASTER_KEY" \
DATABASE_URL="$SUPABASE_URL" \
  pnpm db:rotate-master-key

# Once it reports "all rotated, 0 failed", unset PREVIOUS:
fly secrets unset --app relayhq-api RELAY_MASTER_KEY_PREVIOUS
fly deploy --app relayhq-api
```

---

## Step 8 — Backups (one-time setup, 30 min)

Cross-vendor backup so we're not 100% dependent on Supabase availability.

```bash
# AWS S3 or Cloudflare R2 bucket: relay-prod-backups
# Lifecycle: 30 days → Glacier, 90 days → expire

# Fly cron app or GitHub Actions (whichever you prefer):
#   pg_dump $SUPABASE_URL --format=custom \
#     | s3 cp - s3://relay-prod-backups/postgres/$(date +%Y%m%d).dump

# Test restore quarterly:
pg_restore --no-owner --dbname="$STAGING_DB" relay-prod-YYYYMMDD.dump
```

---

## Checklist

- [ ] Step 0: Snapshot taken
- [ ] Step 1: Migration 004 applied to Supabase
- [ ] Step 2: `relay_app` user created and tested with RLS
- [ ] Step 3: `DATABASE_URL_APP` set in Fly, deploy successful
- [ ] Step 4: NATS deployed, control plane logs show "tool broker: nats"
- [ ] Step 5: Redis wired, rate limit tested with 70 rapid requests
- [ ] Step 6: ClickHouse double-write running for ≥ 7 days, counts match
- [ ] Step 7: Master key rotation tested in staging
- [ ] Step 8: Backup job runs nightly, restore tested
