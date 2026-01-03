-- Renames org_id -> church_id for all *BASE TABLES* in public schema that still have org_id.
-- Safe to run once (and will skip if nothing matches).

do $$
declare
  r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'org_id'
      and t.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    raise notice 'Renaming %.org_id -> church_id', r.table_name;
    execute format('alter table public.%I rename column org_id to church_id', r.table_name);
  end loop;
end $$;
