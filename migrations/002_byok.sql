create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists tenants_name_idx on tenants (name);

create table if not exists api_keys (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  prefix        text not null,
  hashed_secret text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create unique index if not exists api_keys_hashed_secret_idx on api_keys (hashed_secret);
create index if not exists api_keys_tenant_id_idx on api_keys (tenant_id) where revoked_at is null;

create table if not exists provider_credentials (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  provider   text not null,
  label      text,
  ciphertext bytea not null,
  iv         bytea not null,
  auth_tag   bytea not null,
  base_url   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider)
);

alter table runs add column if not exists tenant_id uuid references tenants(id);
create index if not exists runs_tenant_id_idx on runs (tenant_id, created_at desc);
