create view public.v_services_display as
select
  si.id as service_instance_id,
  si.service_date,
  si.service_time,
  sg.id as service_group_id,
  sg.group_date,
  sg.name as service_name,
  sg.context_id,
  ctx.name as context_name,
  si.campus_id,
  c.name as campus_name,
  si.church_id as church_id,
  (sg.name || ' — ') || to_char(si.service_time::interval, 'HH12:MI AM') as display_name,
  case
    when c.name is not null then
      ((sg.name || ' — ') || to_char(si.service_time::interval, 'HH12:MI AM') || ' (' || c.name || ')')
    else
      (sg.name || ' — ') || to_char(si.service_time::interval, 'HH12:MI AM')
  end as display_name_with_campus
from service_instances si
join service_groups sg on si.service_group_id = sg.id
left join campuses c on si.campus_id = c.id
left join contexts ctx on sg.context_id = ctx.id;
