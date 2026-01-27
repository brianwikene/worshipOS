alter table public.people
  add column if not exists date_of_birth date null;

create index if not exists idx_people_dob
  on public.people (church_id, date_of_birth);
