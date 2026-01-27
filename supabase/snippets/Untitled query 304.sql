-- 1) Ensure referenced addresses exist (placeholder rows)
with needed(address_id, church_id, label) as (
  values
    ('beecb417-20a7-4f64-b3ec-32c73eb93715'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Main Campus address'),
    ('de018360-20d1-4026-a288-11a2e8e3a4f4'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'North Campus address'),
    ('50292101-ac96-4d07-aee3-d94244063191'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'South Campus address'),
    ('034c06b1-66a9-48ff-8632-a77f9ededef0'::uuid, '84c66cbb-1f13-4ed2-8416-076755b5dc49'::uuid, 'Ballard address'),
    ('cf2d8b78-a30a-4d77-9d82-5da5989379b9'::uuid, '84c66cbb-1f13-4ed2-8416-076755b5dc49'::uuid, 'Eastside address'),
    ('ce58b8be-a77d-486d-b18a-b550e2821913'::uuid, '84c66cbb-1f13-4ed2-8416-076755b5dc49'::uuid, 'Green Lake address'),
    ('df3518a3-0ee1-4121-a0f3-e7f97e5a4c7c'::uuid, '84c66cbb-1f13-4ed2-8416-076755b5dc49'::uuid, 'North address'),
    ('99941ff8-b7ae-49fe-9e02-475ecd82a195'::uuid, '84c66cbb-1f13-4ed2-8416-076755b5dc49'::uuid, 'Northeast address'),
    ('2951d58d-3896-40bf-907a-6b12beeb5722'::uuid, '84c66cbb-1f13-4ed2-8416-076755b5dc49'::uuid, 'West Seattle address')
)
insert into public.addresses (id, church_id, created_at)
select n.address_id, n.church_id, now()
from needed n
where not exists (
  select 1 from public.addresses a where a.id = n.address_id
);
