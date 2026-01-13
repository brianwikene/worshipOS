drop policy if exists user_links_select_self on public.user_links;

create policy user_links_select_self
on public.user_links
for select
to authenticated
using (user_id = auth.uid());
