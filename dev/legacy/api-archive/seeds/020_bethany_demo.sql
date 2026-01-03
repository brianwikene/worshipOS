begin;

-- 1) Create church (idempotent by name)
with ins as (
  insert into churches (name)
  select 'Bethany Community Church'
  where not exists (select 1 from churches where name='Bethany Community Church')
  returning id
),
church as (
  select id from ins
  union all
  select id from churches where name='Bethany Community Church'
  limit 1
)
select 1;

-- 2) Create campuses
with church as (
  select id as church_id from churches where name='Bethany Community Church' limit 1
)
insert into campuses (id, church_id, name, location, address, is_active)
select gen_random_uuid(), church.church_id, v.name, v.location, v.address, true
from church
cross join (values
  ('BALLARD',     'Seattle, WA',   'Ballard Campus (Satellite)'),
  ('EASTSIDE',    'Bothell, WA',   'Eastside Campus (Satellite)'),
  ('GREEN LAKE',  'Seattle, WA',   'Green Lake Campus (Main Campus)'),
  ('NORTH',       'Shoreline, WA', 'North Campus (Satellite)'),
  ('NORTHEAST',   'Seattle, WA',   'Northeast Campus (Satellite)'),
  ('WEST SEATTLE','Seattle, WA',   'West Seattle Campus (Satellite)')
) v(name, location, address)
where not exists (
  select 1 from campuses c
  where c.church_id = church.church_id and c.name = v.name
);

-- 3) Create structured address rows for campuses, and attach via campuses.address_id
with church as (
  select id as church_id from churches where name='Bethany Community Church' limit 1
),
camp as (
  select id as campus_id, church_id, name, location, address
  from campuses
  where church_id = (select church_id from church)
),
ins_addr as (
  insert into addresses (id, church_id, person_id, label, line1, city, region, postal_code, country, timezone)
  select
    gen_random_uuid(),
    c.church_id,
    null,                -- campus address
    c.name,
    c.address,           -- store your label-ish address string as line1 for now
    split_part(c.location, ', ', 1),
    split_part(c.location, ', ', 2),
    null,
    'US',
    'America/Los_Angeles'
  from camp c
  where not exists (
    select 1 from addresses a
    where a.church_id=c.church_id and a.label=c.name and a.person_id is null
  )
  returning id, church_id, label
)
update campuses c
set address_id = a.id
from addresses a
where c.church_id = (select church_id from church)
  and a.church_id = c.church_id
  and a.label = c.name
  and a.person_id is null
  and c.address_id is null;

-- 4) Contexts
with church as (
  select id as church_id from churches where name='Bethany Community Church' limit 1
)
insert into contexts (id, church_id, name)
select gen_random_uuid(), church.church_id, v.name
from church
cross join (values ('Sunday AM'), ('Youth')) v(name)
where not exists (
  select 1 from contexts c
  where c.church_id = church.church_id and c.name = v.name
);

-- 5) Service groups (one per date/context for the church)
with
church as (select id as church_id from churches where name='Bethany Community Church' limit 1),
ctx as (
  select
    (select id from contexts where church_id=(select church_id from church) and name='Sunday AM' limit 1) as sunday_ctx,
    (select id from contexts where church_id=(select church_id from church) and name='Youth'    limit 1) as youth_ctx
)
insert into service_groups (id, church_id, group_date, name, context_id)
select gen_random_uuid(), (select church_id from church), v.group_date, v.name, v.context_id
from (values
  (date '2025-12-21', 'Sunday AM',  (select sunday_ctx from ctx)),
  (date '2025-12-21', 'Youth Night',(select youth_ctx  from ctx)),
  (date '2025-12-24', 'Youth Night',(select youth_ctx  from ctx))
) v(group_date, name, context_id)
where not exists (
  select 1 from service_groups sg
  where sg.church_id=(select church_id from church)
    and sg.group_date=v.group_date
    and sg.name=v.name
    and sg.context_id=v.context_id
);

-- 6) Service instances (8 Sunday + 2 Youth Sunday + 1 Youth Wed = 11 instances)
with
church as (select id as church_id from churches where name='Bethany Community Church' limit 1),
camp as (
  select id as campus_id, name
  from campuses
  where church_id=(select church_id from church)
),
groups as (
  select
    (select id from service_groups
      where church_id=(select church_id from church) and group_date=date '2025-12-21' and name='Sunday AM'
      order by created_at asc limit 1) as sunday_group_id,
    (select id from service_groups
      where church_id=(select church_id from church) and group_date=date '2025-12-21' and name='Youth Night'
      order by created_at asc limit 1) as youth_sun_group_id,
    (select id from service_groups
      where church_id=(select church_id from church) and group_date=date '2025-12-24' and name='Youth Night'
      order by created_at asc limit 1) as youth_wed_group_id
)
insert into service_instances (id, church_id, service_date, service_time, service_group_id, campus_id)
select gen_random_uuid(), (select church_id from church), v.d, v.t, v.group_id, c.campus_id
from camp c
join (
  values
    -- Sunday services (8 instances)
    ('GREEN LAKE',  date '2025-12-21', time '08:00', (select sunday_group_id from groups)),
    ('GREEN LAKE',  date '2025-12-21', time '09:30', (select sunday_group_id from groups)),
    ('GREEN LAKE',  date '2025-12-21', time '11:00', (select sunday_group_id from groups)),
    ('BALLARD',     date '2025-12-21', time '09:30', (select sunday_group_id from groups)),
    ('EASTSIDE',    date '2025-12-21', time '10:00', (select sunday_group_id from groups)),
    ('NORTH',       date '2025-12-21', time '09:30', (select sunday_group_id from groups)),
    ('NORTHEAST',   date '2025-12-21', time '09:30', (select sunday_group_id from groups)),
    ('WEST SEATTLE',date '2025-12-21', time '09:30', (select sunday_group_id from groups)),

    -- Youth Sunday night (2 instances)
    ('GREEN LAKE',  date '2025-12-21', time '18:00', (select youth_sun_group_id from groups)),
    ('NORTH',       date '2025-12-21', time '18:30', (select youth_sun_group_id from groups)),

    -- Youth Wednesday night (1 instance)
    ('BALLARD',     date '2025-12-24', time '19:00', (select youth_wed_group_id from groups))
) v(campus_name, d, t, group_id)
  on v.campus_name = c.name
where not exists (
  select 1 from service_instances si
  where si.church_id=(select church_id from church)
    and si.service_date=v.d
    and si.service_time=v.t
    and si.campus_id=c.campus_id
);

commit;
