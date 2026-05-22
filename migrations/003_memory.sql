create extension if not exists vector;

create table if not exists memories (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  namespace     text not null,
  content       text not null,
  embedding     vector(1536) not null,
  metadata      jsonb not null default '{}'::jsonb,
  source_run_id uuid references runs(id) on delete set null,
  created_at    timestamptz not null default now(),
  ttl_at        timestamptz
);

create index if not exists memories_tenant_namespace_idx
  on memories (tenant_id, namespace, created_at desc);

create index if not exists memories_embedding_idx
  on memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists memories_ttl_idx
  on memories (ttl_at) where ttl_at is not null;

alter table runs add column if not exists memory_namespace text;
