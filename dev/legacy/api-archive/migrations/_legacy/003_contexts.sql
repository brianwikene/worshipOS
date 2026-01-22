-- /dev/legacy/api-archive/migrations/_legacy/003_contexts.sql
-- If you already ran this in 001, it’s safe to repeat
create extension if not exists pgcrypto;

create table if not exists contexts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists contexts_org_id_idx
  on contexts(org_id);
