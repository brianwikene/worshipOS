-- /supabase/snippets/Untitled query 676.sql
select
  conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'service_items'
  and conname in (
    'service_items_song_variant_required_for_song',
    'service_items_related_item_id_fkey'
  );
