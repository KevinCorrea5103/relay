-- ─────────────────────────────────────────────────────────────────────────
-- 004_security.sql
--
-- 1. Denormalizes tenant_id into run_events so RLS doesn't pay a join cost.
-- 2. Creates the audit_events table — every security-relevant action lands
--    here, scoped per tenant.
-- 3. Enables Row-Level Security on tenant tables with a uniform policy:
--      a row is visible iff
--        current_setting('app.bypass_rls', true) = 'on'         (admin context)
--        OR tenant_id::text = current_setting('app.tenant_id', true)
--    Default (neither set) → no rows. Safe-by-default.
-- 4. Provisions a non-owner role `relay_app` so the app process can connect
--    as a principal that does NOT bypass RLS. The owner role (used by
--    migrations / bootstrap) continues to bypass — that's the point.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Denormalize tenant_id into run_events ───────────────────────────

alter table run_events
  add column if not exists tenant_id uuid references tenants(id) on delete cascade;

update run_events
   set tenant_id = (select tenant_id from runs where runs.id = run_events.run_id)
 where tenant_id is null;

-- Don't enforce NOT NULL retroactively if there are orphan rows; new rows
-- are required to set it. (The application code is updated in this commit.)
do $$
begin
  if not exists (
    select 1 from run_events where tenant_id is null
  ) then
    execute 'alter table run_events alter column tenant_id set not null';
  end if;
end$$;

create index if not exists run_events_tenant_idx
  on run_events (tenant_id, ts desc);

-- ─── 2. Audit log table ─────────────────────────────────────────────────

create table if not exists audit_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  -- Who did it. e.g. "api_key:<keyId>", "admin", "system", "signup"
  actor        text not null,
  -- What happened. dot-namespaced. e.g. "api_key.created", "credential.updated",
  -- "master_key.rotated", "tenant.signed_up".
  action       text not null,
  -- Optional target identifiers for the action.
  target_type  text,
  target_id    text,
  -- Arbitrary structured detail.
  metadata     jsonb not null default '{}'::jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_events_tenant_idx
  on audit_events (tenant_id, created_at desc);

create index if not exists audit_events_action_idx
  on audit_events (tenant_id, action, created_at desc);

-- ─── 3. RLS policies ────────────────────────────────────────────────────

-- Common visibility predicate, dropped/recreated idempotently below.
-- We use current_setting(..., true) which returns NULL when missing (instead
-- of erroring), then compare against the row's tenant_id::text.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'tenants', 'api_keys', 'provider_credentials',
      'runs', 'run_events', 'memories', 'audit_events'
    ])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end$$;

-- tenants: policy keys off `id`, not `tenant_id` (it IS the tenant).
drop policy if exists tenant_isolation on tenants;
create policy tenant_isolation on tenants
  using (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or id::text = nullif(current_setting('app.tenant_id', true), '')
  )
  with check (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or id::text = nullif(current_setting('app.tenant_id', true), '')
  );

drop policy if exists tenant_isolation on api_keys;
create policy tenant_isolation on api_keys
  using (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  )
  with check (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  );

drop policy if exists tenant_isolation on provider_credentials;
create policy tenant_isolation on provider_credentials
  using (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  )
  with check (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  );

drop policy if exists tenant_isolation on runs;
create policy tenant_isolation on runs
  using (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  )
  with check (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  );

drop policy if exists tenant_isolation on run_events;
create policy tenant_isolation on run_events
  using (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  )
  with check (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  );

drop policy if exists tenant_isolation on memories;
create policy tenant_isolation on memories
  using (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  )
  with check (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  );

drop policy if exists tenant_isolation on audit_events;
create policy tenant_isolation on audit_events
  using (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  )
  with check (
    coalesce(current_setting('app.bypass_rls', true), '') = 'on'
    or tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
  );

-- ─── 4. relay_app role (RLS-enforced principal) ─────────────────────────
--
-- Idempotent role creation. The migration is run as the DB owner (superuser
-- or schema owner) which bypasses RLS naturally. The application connects
-- through DATABASE_URL_APP as relay_app, which does NOT bypass RLS.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'relay_app') then
    create role relay_app login password 'relay_app';
  end if;
end$$;

grant usage on schema public to relay_app;
grant select, insert, update, delete on
  tenants, api_keys, provider_credentials,
  runs, run_events, memories, audit_events
  to relay_app;
grant usage, select on all sequences in schema public to relay_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to relay_app;
alter default privileges in schema public
  grant usage, select on sequences to relay_app;
