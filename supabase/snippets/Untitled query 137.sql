select policyname, cmd, roles, qual
from pg_policies
where schemaname='public'
  and tablename='care_cases'
order by cmd, policyname;
