-- /dev/legacy/api-archive/migrations/_legacy/002_service_groups.sql
create table if not exists service_groups (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists service_groups_org_id_idx
  on service_groups(org_id);
