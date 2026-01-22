-- /dev/legacy/api-archive/seeds/021_bethany_songs_people_families.sql
begin;

-- Bethany church id
with church as (
  select id as church_id from churches where name='Bethany Community Church' limit 1
)
select 1;

-- 1) Songs: 15 main + 5 youth-only
with church as (
  select id as church_id from churches where name='Bethany Community Church' limit 1
)
insert into songs (id, church_id, title, artist, key, bpm, notes)
select gen_random_uuid(), (select church_id from church), v.title, v.artist, v.key, v.bpm, v.notes
from (values
  ('Open Hands', 'Bethany Worship', 'G', 72, null),
  ('Anchor in the Storm', 'Bethany Worship', 'D', 76, null),
  ('Morning Mercy', 'Bethany Worship', 'A', 68, null),
  ('Bright and Holy', 'Bethany Worship', 'E', 80, null),
  ('Carry the Light', 'Bethany Worship', 'C', 74, null),
  ('Here in the Waiting', 'Bethany Worship', 'F', 70, null),
  ('Grace Upon Grace', 'Bethany Worship', 'B', 78, null),
  ('Come As You Are', 'Bethany Worship', 'G', 84, null),
  ('Oceans of Peace', 'Bethany Worship', 'D', 66, null),
  ('Kingdom Near', 'Bethany Worship', 'A', 88, null),
  ('Faithful Again', 'Bethany Worship', 'E', 75, null),
  ('Lifted High', 'Bethany Worship', 'C', 92, null),
  ('Quiet Fire', 'Bethany Worship', 'F', 64, null),
  ('Hope Has a Name', 'Bethany Worship', 'B', 82, null),
  ('Send Us Out', 'Bethany Worship', 'F', 96, null),

  ('YOUTH: Loud Faith', 'Bethany Youth', 'E', 110, null),
  ('YOUTH: Run to the Light', 'Bethany Youth', 'G', 124, null),
  ('YOUTH: No Shame', 'Bethany Youth', 'A', 118, null),
  ('YOUTH: Heart on Fire', 'Bethany Youth', 'D', 132, null),
  ('YOUTH: Better Together', 'Bethany Youth', 'C', 105, null)
) v(title, artist, key, bpm, notes)
where not exists (
  select 1 from songs s
  where s.church_id=(select church_id from church) and s.title=v.title
);

-- 2) People: generate ~130 names
do $$
declare
  bethany uuid;
  has_people_campus boolean;
  green uuid; ballard uuid; eastside uuid; north uuid; northeast uuid; westsea uuid;
begin
  select id into bethany from churches where name='Bethany Community Church' limit 1;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='people' and column_name='campus_id'
  ) into has_people_campus;

  select id into green    from campuses where church_id=bethany and name='GREEN LAKE' limit 1;
  select id into ballard  from campuses where church_id=bethany and name='BALLARD' limit 1;
  select id into eastside from campuses where church_id=bethany and name='EASTSIDE' limit 1;
  select id into north    from campuses where church_id=bethany and name='NORTH' limit 1;
  select id into northeast from campuses where church_id=bethany and name='NORTHEAST' limit 1;
  select id into westsea  from campuses where church_id=bethany and name='WEST SEATTLE' limit 1;

  -- Build a temp set of display names
  create temporary table if not exists tmp_bethany_people(name text) on commit drop;

  insert into tmp_bethany_people(name)
  select (first || ' ' || last || ' ' || n)::text
  from (values
    ('Ava','Nguyen'),('Noah','Martinez'),('Mia','Johnson'),('Ethan','Kim'),('Sophia','Lee'),
    ('Liam','Patel'),('Olivia','Brown'),('Lucas','Garcia'),('Isla','Davis'),('Henry','Wilson'),
    ('Amelia','Clark'),('Jack','Lewis'),('Harper','Walker'),('Leo','Hall'),('Ella','Allen'),
    ('Wyatt','Young'),('Chloe','Hernandez'),('Mason','King'),('Grace','Wright'),('James','Scott'),
    ('Nora','Green'),('Caleb','Baker'),('Zoe','Adams'),('Owen','Nelson'),('Lily','Carter'),
    ('Asher','Mitchell'),('Aria','Perez'),('Sebastian','Roberts'),('Layla','Turner'),('Daniel','Phillips'),
    ('Ruby','Campbell'),('Finn','Parker'),('Ivy','Evans'),('Ezra','Edwards'),('Hazel','Collins'),
    ('Miles','Stewart'),('Stella','Sanchez'),('Elijah','Morris'),('Violet','Rogers'),('Hudson','Reed'),
    ('Sienna','Cook'),('Logan','Morgan'),('Penelope','Bell'),('Carter','Murphy'),('Aurora','Bailey')
  ) nms(first,last)
  cross join generate_series(1,3) n
  limit 130;

  if has_people_campus then
    insert into people (id, church_id, display_name, campus_id)
    select
      gen_random_uuid(),
      bethany,
      p.name,
      case
        when row_number() over () <= 52 then green           -- ~40%
        when row_number() over () <= 65 then ballard         -- ~10%
        when row_number() over () <= 78 then eastside
        when row_number() over () <= 91 then north
        when row_number() over () <= 104 then northeast
        else westsea
      end
    from tmp_bethany_people p
    where not exists (select 1 from people x where x.church_id=bethany and x.display_name=p.name);
  else
    insert into people (id, church_id, display_name)
    select gen_random_uuid(), bethany, p.name
    from tmp_bethany_people p
    where not exists (select 1 from people x where x.church_id=bethany and x.display_name=p.name);
  end if;
end $$;

-- 3) Families: create 3 per campus + assign 3-5 people each (best-effort)
do $$
declare
  bethany uuid;
  has_families_campus boolean;
begin
  select id into bethany from churches where name='Bethany Community Church' limit 1;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='families' and column_name='campus_id'
  ) into has_families_campus;

  create temporary table if not exists tmp_bethany_fams(campus_id uuid, fam_name text) on commit drop;

  insert into tmp_bethany_fams(campus_id, fam_name)
  select c.id, (c.name || ' Family ' || n)::text
  from campuses c
  cross join generate_series(1,3) n
  where c.church_id=bethany;

  if has_families_campus then
    insert into families (id, church_id, campus_id, name, notes, is_active)
    select gen_random_uuid(), bethany, f.campus_id, f.fam_name, null, true
    from tmp_bethany_fams f
    where not exists (select 1 from families x where x.church_id=bethany and x.name=f.fam_name);
  else
    insert into families (id, church_id, name, notes, is_active)
    select gen_random_uuid(), bethany, f.fam_name, null, true
    from tmp_bethany_fams f
    where not exists (select 1 from families x where x.church_id=bethany and x.name=f.fam_name);
  end if;

  -- Assign members: take people in order, chunk into families (this is for test data, not realism)
  insert into family_members (id, church_id, family_id, person_id, relationship, is_primary_contact, is_active)
  select
    gen_random_uuid(),
    bethany,
    f.id as family_id,
    p.id as person_id,
    case when (row_number() over (partition by f.id order by p.display_name) = 3) then 'child' else 'adult' end,
    case when (row_number() over (partition by f.id order by p.display_name) = 1) then true else false end,
    true
  from families f
  join lateral (
    select p.*
    from people p
    where p.church_id=bethany
    order by random()
    limit (3 + (random()*2)::int)  -- 3-5
  ) p on true
  where f.church_id=bethany
    and not exists (
      select 1 from family_members fm
      where fm.family_id=f.id and fm.person_id=p.id
    );
end $$;

commit;
