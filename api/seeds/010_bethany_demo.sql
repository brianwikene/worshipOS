-- Bethany Community Church demo seed
-- Safe-ish: inserts only if the church name doesn't already exist.

begin;

-- 1) Church
with inserted as (
  insert into churches (id, name)
  select gen_random_uuid(), 'Bethany Community Church'
  where not exists (select 1 from churches where name = 'Bethany Community Church')
  returning id
),
church as (
  select id from inserted
  union all
  select id from churches where name = 'Bethany Community Church'
  limit 1
)

-- 2) Campuses
insert into campuses (id, church_id, name, city, state, campus_type)
select gen_random_uuid(), church.id, v.name, v.city, v.state, v.campus_type
from church
cross join (values
  ('GREEN LAKE',  'Seattle',   'WA', 'Main'),
  ('BALLARD',     'Seattle',   'WA', 'Satellite'),
  ('EASTSIDE',    'Bothell',   'WA', 'Satellite'),
  ('NORTH',       'Shoreline', 'WA', 'Satellite'),
  ('NORTHEAST',   'Seattle',   'WA', 'Satellite'),
  ('WEST SEATTLE','Seattle',   'WA', 'Satellite')
) as v(name, city, state, campus_type)
where not exists (
  select 1 from campuses c
  where c.church_id = church.id and c.name = v.name
);

-- 3) Contexts (Sunday + Youth)
with church as (
  select id from churches where name = 'Bethany Community Church' limit 1
)
insert into contexts (id, church_id, name)
select gen_random_uuid(), church.id, v.name
from church
cross join (values
  ('Sunday AM'),
  ('Youth')
) as v(name)
where not exists (
  select 1 from contexts c
  where c.church_id = church.id and c.name = v.name
);

-- 4) Service Groups + Instances for a single “test week”
-- We'll create: Sunday 2025-12-21 and Wednesday 2025-12-24 (adjust dates if you want)
-- Sunday services = 8 instances total, Youth = 2 instances total
with
church as (
  select id as church_id from churches where name = 'Bethany Community Church' limit 1
),
ctx as (
  select
    (select id from contexts where church_id = (select church_id from church) and name = 'Sunday AM' limit 1) as sunday_ctx,
    (select id from contexts where church_id = (select church_id from church) and name = 'Youth'    limit 1) as youth_ctx
),
camp as (
  select name, id
  from campuses
  where church_id = (select church_id from church)
),
-- one service_group per campus/date/context
groups as (
  insert into service_groups (id, church_id, group_date, name, context_id)
  select
    gen_random_uuid(),
    (select church_id from church),
    v.group_date,
    v.group_name,
    v.context_id
  from (
    -- Sunday groups
    select date '2025-12-21' as group_date, 'Sunday AM' as group_name, (select sunday_ctx from ctx) as context_id, 'ALL_SUNDAY' as bucket
    union all
    -- Youth Wednesday group
    select date '2025-12-24', 'Youth Night', (select youth_ctx from ctx), 'YOUTH_WED'
    union all
    -- Youth Sunday night group
    select date '2025-12-21', 'Youth Night', (select youth_ctx from ctx), 'YOUTH_SUN'
  ) v
  -- create 1 group per campus for Sunday, and 1 group for Green Lake youth events
  cross join lateral (
    select 1
  ) _x
  -- We’ll create campus-specific groups by duplicating rows per campus as needed below:
  returning id, group_date, name, context_id, church_id
)
select 1;

-- Create Sunday AM groups per campus (6 campuses)
with
church as (select id as church_id from churches where name='Bethany Community Church' limit 1),
sunday_ctx as (
  select id from contexts where church_id=(select church_id from church) and name='Sunday AM' limit 1
),
camp as (
  select id as campus_id, name as campus_name
  from campuses where church_id=(select church_id from church)
),
sg as (
  insert into service_groups (id, church_id, group_date, name, context_id)
  select gen_random_uuid(), (select church_id from church), date '2025-12-21', 'Sunday AM', (select id from sunday_ctx)
  from camp
  where not exists (
    select 1 from service_groups g
    where g.church_id=(select church_id from church)
      and g.group_date=date '2025-12-21'
      and g.name='Sunday AM'
      and g.context_id=(select id from sunday_ctx)
      -- if you later add campus_id on service_groups, you’ll move this uniqueness check there
  )
  returning id
)
select 1;

-- Instances: 8 Sunday instances + 2 youth instances (Green Lake youth)
with
church as (select id as church_id from churches where name='Bethany Community Church' limit 1),
sunday_ctx as (select id as context_id from contexts where church_id=(select church_id from church) and name='Sunday AM' limit 1),
youth_ctx  as (select id as context_id from contexts where church_id=(select church_id from church) and name='Youth' limit 1),
camp as (
  select name, id
  from campuses
  where church_id=(select church_id from church)
),
-- pick one Sunday group id to attach instances to per campus.
-- If your model expects campus-specific grouping, you can later add campus_id to service_groups.
sunday_group as (
  select id as group_id
  from service_groups
  where church_id=(select church_id from church)
    and group_date=date '2025-12-21'
    and name='Sunday AM'
    and context_id=(select context_id from sunday_ctx)
  order by created_at asc
  limit 1
),
youth_group_sun as (
  insert into service_groups (id, church_id, group_date, name, context_id)
  select gen_random_uuid(), (select church_id from church), date '2025-12-21', 'Youth Night', (select context_id from youth_ctx)
  where not exists (
    select 1 from service_groups
    where church_id=(select church_id from church)
      and group_date=date '2025-12-21'
      and name='Youth Night'
      and context_id=(select context_id from youth_ctx)
  )
  returning id
),
youth_group_wed as (
  insert into service_groups (id, church_id, group_date, name, context_id)
  select gen_random_uuid(), (select church_id from church), date '2025-12-24', 'Youth Night', (select context_id from youth_ctx)
  where not exists (
    select 1 from service_groups
    where church_id=(select church_id from church)
      and group_date=date '2025-12-24'
      and name='Youth Night'
      and context_id=(select context_id from youth_ctx)
  )
  returning id
)
insert into service_instances (id, church_id, service_date, service_time, service_group_id, campus_id)
select gen_random_uuid(), (select church_id from church), date '2025-12-21', v.t, (select group_id from sunday_group), c.id
from camp c
join (
  -- Sunday times by campus
  values
    ('GREEN LAKE'::text,  time '08:00'),
    ('GREEN LAKE'::text,  time '09:30'),
    ('GREEN LAKE'::text,  time '11:00'),
    ('BALLARD'::text,     time '09:30'),
    ('EASTSIDE'::text,    time '10:00'),
    ('NORTH'::text,       time '09:30'),
    ('NORTHEAST'::text,   time '09:30'),
    ('WEST SEATTLE'::text,time '09:30')
) v(campus_name, t)
  on v.campus_name = c.name
where not exists (
  select 1 from service_instances si
  where si.church_id=(select church_id from church)
    and si.service_date=date '2025-12-21'
    and si.service_time=v.t
    and si.campus_id=c.id
);

-- Youth instances (Green Lake Sunday + Ballard Wednesday + North Sunday)
with
church as (select id as church_id from churches where name='Bethany Community Church' limit 1),
camp as (select name, id from campuses where church_id=(select church_id from church)),
youth_ctx as (select id as context_id from contexts where church_id=(select church_id from church) and name='Youth' limit 1),
youth_group_sun as (
  select id as group_id from service_groups
  where church_id=(select church_id from church)
    and group_date=date '2025-12-21'
    and name='Youth Night'
    and context_id=(select context_id from youth_ctx)
  limit 1
),
youth_group_wed as (
  select id as group_id from service_groups
  where church_id=(select church_id from church)
    and group_date=date '2025-12-24'
    and name='Youth Night'
    and context_id=(select context_id from youth_ctx)
  limit 1
)
insert into service_instances (id, church_id, service_date, service_time, service_group_id, campus_id)
select gen_random_uuid(), (select church_id from church), v.d, v.t, v.group_id, c.id
from camp c
join (
  values
    -- Green Lake Youth Sunday 6pm
    ('GREEN LAKE'::text, date '2025-12-21', time '18:00', (select group_id from youth_group_sun)),
    -- North Youth Sunday 6:30pm
    ('NORTH'::text,      date '2025-12-21', time '18:30', (select group_id from youth_group_sun)),
    -- Ballard Youth Wednesday 7pm
    ('BALLARD'::text,    date '2025-12-24', time '19:00', (select group_id from youth_group_wed))
) v(campus_name, d, t, group_id)
  on v.campus_name = c.name
where not exists (
  select 1 from service_instances si
  where si.church_id=(select church_id from church)
    and si.service_date=v.d
    and si.service_time=v.t
    and si.campus_id=c.id
);

commit;
