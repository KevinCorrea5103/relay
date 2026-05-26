# Production deploy runbook

Two parts:
- **Part A — One-time setup** (CI/CD, secrets, services). Do once per
  fresh environment.
- **Part B — Staged rollout** of the scale stack (NATS, Redis,
  ClickHouse, backups). Do as you actually hit each scale boundary.

After Part A, **every push to `main` deploys itself** — GitHub Actions
runs CI + integration suite, then `flyctl deploy` on the control plane
(which applies pending migrations via its `release_command`) and the
runtime. Manual `fly deploy` from a laptop is only the **fallback when
CI is broken**.

---

# Part A — One-time CI/CD setup

## Step −1 — GitHub secrets + Production environment (10 min)

CI deploys against your real Fly + npm + PyPI accounts. It needs three
credentials, stored in the **Production environment** so workflows scoped
to `environment: Production` can read them.

### Generate the credentials

| Secret | Generate with |
|---|---|
| `FLY_API_TOKEN` | `fly tokens create org -x 999999h` (paste the entire `FlyV1 ...` string, including the prefix and trailing `=,fm2_...`) |
| `NPM_TOKEN` | npmjs.com → Access Tokens → Classic → **Automation type** (bypasses 2FA in CI) |
| `PYPI_TOKEN` | pypi.org → Account → API tokens → scope to the `relayhq` project |

### Wire them in GitHub

1. Repo → **Settings → Environments → New environment** → name it
   `Production`
2. Under that environment: **Add secret** → add all three by name
   (`FLY_API_TOKEN`, `NPM_TOKEN`, `PYPI_TOKEN`)
3. Optional protection rules to consider:
   - **Required reviewers** → makes every deploy require a manual
     approval click. Worth turning on once you have a team.
   - **Deployment branches** → restrict to `main`.

> Putting these as plain **Repository secrets** does NOT work — the
> workflows declare `environment: Production` and look for them there.

### Verify

Push any trivial change to `main`. Within ~30s, all three workflows
appear under Actions:
- `CI` → typecheck + builds
- `CI · Integration` → full suite against ephemeral Postgres + Redis +
  NATS + ClickHouse
- `Deploy` → `Control plane → Fly` and `Runtime (Go) → Fly`

If `Deploy` shows `FLY_API_TOKEN: ***` (masked, not empty) the secrets
are wired correctly.

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

**Automatic path (default)**: the next `Deploy` workflow run applies any
pending migrations via `release_command` before any new control-plane
instance takes traffic. A migration failure aborts the deploy cleanly
(zero-downtime — old instances keep serving).

**Manual fallback** (if you need to apply a migration *before* the next
deploy, or CI is broken):

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

## Step 3 — Wire DATABASE_URL_APP + redeploy (5 min)

```bash
fly secrets set --app relayhq-api \
  DATABASE_URL_APP="postgres://relay_app:<password>@db.xxxxx.supabase.co:5432/postgres"
# Setting a secret triggers a rolling restart automatically.
```

If you just want to redeploy without changing secrets, push a trivial
commit (`git commit --allow-empty -m "redeploy"; git push`) or in the
GitHub UI: Actions → Deploy → Run workflow.

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

# Part C — Day-2 operations

Things you'll want to know how to do once you're past the rollout.

## Watching a deploy in flight

```bash
# All in-flight runs:
gh run list --limit 5

# Watch one until it finishes (auto-refreshes, exits on done):
gh run watch <run-id>

# Drill into a job:
gh run view <run-id> --log
gh run view <run-id> --log-failed     # only failure lines
```

## Reading prod logs

```bash
fly logs --app relayhq-api              # live tail
fly logs --app relayhq-api --no-tail    # last N lines, exit

fly status --app relayhq-api            # machine count, last deploy id
fly releases --app relayhq-api          # deploy history with image refs
```

## Smoke test prod after a deploy

```bash
export RELAY_API_KEY=relay_live_...

# Health
curl -i https://api.relaygh.dev/health

# Run with streaming
curl -X POST https://api.relaygh.dev/v1/runs \
  -H "Authorization: Bearer $RELAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","input":"hello"}' \
  --no-buffer

# Audit log (verify writes from this session show up)
curl -H "Authorization: Bearer $RELAY_API_KEY" \
     https://api.relaygh.dev/v1/audit | jq .

# Rate-limit headers should be present
curl -i -H "Authorization: Bearer $RELAY_API_KEY" \
     https://api.relaygh.dev/v1/keys | grep -i ratelimit
```

## Releasing the SDK

```bash
# TypeScript
# 1. Bump packages/sdk/package.json version
# 2. Commit + push
git tag sdk-ts-v0.2.0 && git push origin sdk-ts-v0.2.0
# → release-sdk.yml publishes to npm with --provenance

# Python — same pattern with sdks/python/pyproject.toml
git tag sdk-py-v0.2.0 && git push origin sdk-py-v0.2.0
```

The workflow refuses to publish if the tag version doesn't match the
package metadata version. That's intentional — prevents the classic
"tagged v0.2.0, forgot to bump package.json" footgun.

---

# Part D — Recovery scenarios

## Migration aborted the deploy

The `release_command` exited non-zero → Fly kept the old instances
running. Your traffic is fine.

```bash
# 1. Read the failure
gh run view <run-id> --log-failed

# 2. Fix the migration file locally, push the fix
# 3. Next deploy retries

# If the migration partially applied (shouldn't happen — each runs in a
# transaction — but theoretically possible with bad DDL):
psql "$DATABASE_URL" -c "select * from schema_migrations order by applied_at desc;"
# Manually clean up or restore from snapshot if needed.
```

## App deploy succeeded but runtime is broken

Roll back to the previous image:

```bash
fly releases --app relayhq-api
# Find the previous good release id (e.g. v123)

fly deploy --app relayhq-api --image registry.fly.io/relayhq-api@<sha-of-prev>
```

Then revert the bad commit on `main`:

```bash
git revert <bad-sha>
git push origin main
```

## Bad commit pushed to main (CI was green but it's wrong)

```bash
git revert <bad-sha>
git push origin main
# → triggers a fresh Deploy with the revert
```

Auto-deploy makes this faster than rolling back the Fly image, in most
cases.

## Lost or compromised credentials

| Lost | Recovery |
|---|---|
| `FLY_API_TOKEN` | `fly tokens revoke <id>` then `fly tokens create org` → update GitHub secret |
| `NPM_TOKEN` | npmjs.com → revoke → regenerate Automation token → update GitHub |
| `PYPI_TOKEN` | pypi.org → revoke → regenerate scoped to `relayhq` → update GitHub |
| `RELAY_MASTER_KEY` (think it leaked) | Follow Step 7 (rotation) urgently. Generate new, set as primary, set old as `RELAY_MASTER_KEY_PREVIOUS`, run `pnpm db:rotate-master-key`, then unset previous. |
| `RELAY_INTERNAL_SECRET` | Generate a new random ~32-byte string; `fly secrets set` on both `relayhq-api` and `relay-runtime` to the same value, redeploy both. |
| `relay_app` Postgres password | `ALTER ROLE relay_app WITH PASSWORD '<new>';` then `fly secrets set DATABASE_URL_APP="..."` with the new password |

## Status check

```bash
# All in one place:
gh run list --limit 10                         # CI/CD state
fly status --app relayhq-api                   # control plane
fly status --app relay-runtime                 # runtime
curl -i https://api.relaygh.dev/health         # public health
psql "$DATABASE_URL" -c "select count(*) from schema_migrations;"   # DB schema
```

---

# Checklist

## Part A — one-time CI/CD setup
- [ ] Step −1: 3 secrets in GitHub Production environment, verified via Actions log showing masked values
- [ ] Step 0: Snapshot taken
- [ ] Step 1: Migration 004 applied to Supabase (auto via release_command or manual)
- [ ] Step 2: `relay_app` user created and tested with RLS
- [ ] Step 3: `DATABASE_URL_APP` set in Fly, deploy successful
- [ ] Smoke test passes against prod

## Part B — staged scale rollout (do as you hit each ceiling)
- [ ] Step 4: NATS deployed, control plane logs show "tool broker: nats"
- [ ] Step 5: Redis wired, rate limit tested with 70 rapid requests
- [ ] Step 6: ClickHouse double-write running for ≥ 7 days, counts match
- [ ] Step 7: Master key rotation tested in staging
- [ ] Step 8: Backup job runs nightly, restore tested
