create extension if not exists pgcrypto;

create table if not exists runs (
  id           uuid primary key default gen_random_uuid(),
  status       text not null check (status in ('running', 'completed', 'failed', 'canceled')),
  model        text not null,
  system       text,
  input        text not null,
  tools        jsonb not null default '[]'::jsonb,
  output       text,
  error        text,
  input_tokens  integer,
  output_tokens integer,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

create index if not exists runs_created_at_idx on runs (created_at desc);
create index if not exists runs_status_idx     on runs (status);

create table if not exists run_events (
  run_id  uuid not null references runs(id) on delete cascade,
  seq     integer not null,
  type    text not null,
  payload jsonb not null,
  ts      timestamptz not null default now(),
  primary key (run_id, seq)
);

create index if not exists run_events_run_id_idx on run_events (run_id, seq);
