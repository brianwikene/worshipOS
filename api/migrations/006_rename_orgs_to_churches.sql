-- 006_rename_orgs_to_churches.sql

-- 1) orgs -> churches
alter table orgs rename to churches;

-- 2) org_id -> church_id on core tables
alter table service_groups rename column org_id to church_id;
alter table service_instances rename column org_id to church_id;
alter table roles rename column org_id to church_id;
alter table contexts rename column org_id to church_id;
alter table people rename column org_id to church_id;
alter table families rename column org_id to church_id;
alter table family_members rename column org_id to church_id;

-- 3) Add/refresh helpful indexes (names don't have to be perfect)
create index if not exists idx_service_groups_church_date on service_groups(church_id, group_date);
create index if not exists idx_service_instances_church_date on service_instances(church_id, service_date, service_time);
create index if not exists idx_roles_church on roles(church_id);
