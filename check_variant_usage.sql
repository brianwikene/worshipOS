-- /check_variant_usage.sql
select count(*) from service_items where song_variant_id is not null;
