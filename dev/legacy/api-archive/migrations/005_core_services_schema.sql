-- /dev/legacy/api-archive/migrations/005_core_services_schema.sql
-- 005_tenancy_and_services_core.sql
-- Tenancy: church_id is the hard isolation boundary
-- Campus: scope filter within a church

create extension if not exists pgcrypto;

-- ----------------------------
-- Tenancy / org structure
-- ----------------------------
create table if not exists churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists campuses (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(church_id, name)
);

create index if not exists campuses_church_id_idx on campuses(church_id);

-- ----------------------------
-- Contexts (service “templates” / types)
-- ----------------------------
create table if not exists contexts (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(church_id, name)
);

create index if not exists contexts_church_id_idx on contexts(church_id);

-- ----------------------------
-- Service groups (a “date container” for one or more instances)
-- ----------------------------
create table if not exists service_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,

  -- your query expects sg.group_date
  group_date date not null,

  name text not null,

  -- your query expects sg.context_id
  context_id uuid references contexts(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists service_groups_church_id_date_idx
  on service_groups(church_id, group_date);

create index if not exists service_groups_context_id_idx
  on service_groups(context_id);

-- ----------------------------
-- Service instances (individual service times under a group)
-- ----------------------------
create table if not exists service_instances (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  service_group_id uuid not null references service_groups(id) on delete cascade,

  -- your query expects si.service_time; timestamp is flexible
  service_time timestamptz not null,

  campus_id uuid references campuses(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists service_instances_group_id_idx
  on service_instances(service_group_id);

create index if not exists service_instances_church_time_idx
  on service_instances(church_id, service_time);

create index if not exists service_instances_campus_id_idx
  on service_instances(campus_id);

-- ----------------------------
-- Roles (worship/production positions)
-- ----------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,

  name text not null,

  -- your query expects roles.ministry_area
  ministry_area text,

  created_at timestamptz not null default now(),
  unique(church_id, name)
);

create index if not exists roles_church_id_idx on roles(church_id);
create index if not exists roles_ministry_area_idx on roles(ministry_area);

-- ----------------------------
-- Role requirements per context
-- ----------------------------
create table if not exists service_role_requirements (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  context_id uuid not null references contexts(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  quantity int not null default 1,

  created_at timestamptz not null default now(),
  unique(context_id, role_id)
);

create index if not exists srr_context_id_idx on service_role_requirements(context_id);
create index if not exists srr_role_id_idx on service_role_requirements(role_id);

-- ----------------------------
-- People (minimal table because assignments reference person_id)
-- ----------------------------
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  full_name text not null,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists people_church_id_idx on people(church_id);

-- ----------------------------
-- Assignments (who is scheduled for what)
-- ----------------------------
do $$ begin
  create type assignment_status as enum ('pending', 'confirmed', 'declined');
exception
  when duplicate_object then null;
end $$;

create table if not exists service_assignments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  service_instance_id uuid not null references service_instances(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,

  -- your query expects nullable person_id
  person_id uuid references people(id) on delete set null,

  status assignment_status not null default 'pending',

  created_at timestamptz not null default now(),

  -- prevents duplicate role assignment rows for the same instance
  unique(service_instance_id, role_id, person_id)
);

create index if not exists sa_instance_id_idx on service_assignments(service_instance_id);
create index if not exists sa_role_id_idx on service_assignments(role_id);
create index if not exists sa_person_id_idx on (person_id);
create index if not exists sa_status_idx on service_assignments(status);

-- ----------------------------
-- Safety rails: keep cross-tenant references from happening accidentally
-- (These are “soft” rails via conventions + app logic; true enforcement
-- would require composite keys or triggers. We'll keep it simple for now.)
-- ----------------------------
