CREATE OR REPLACE FUNCTION public.get_service_roster(p_service_instance_id uuid)
RETURNS TABLE(
    ministry_area text,
    role_name text,
    role_id uuid,
    person_id uuid,
    person_name text,
    status text,
    is_lead boolean,
    is_required boolean,
    notes text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.ministry_area,
    r.name as role_name,
    r.id as role_id,
    sa.person_id,
    p.display_name as person_name,
    COALESCE(sa.status, 'unfilled') as status,
    COALESCE(sa.is_lead, false) as is_lead,
    (srr.min_needed > 0) as is_required, -- FIXED: Calculates boolean from min_needed
    sa.notes
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  JOIN service_role_requirements srr ON srr.context_id = sg.context_id
  JOIN roles r ON r.id = srr.role_id
  LEFT JOIN service_assignments sa ON sa.service_instance_id = si.id AND sa.role_id = r.id
  LEFT JOIN people p ON p.id = sa.person_id
  WHERE si.id = p_service_instance_id
  ORDER BY
    r.ministry_area,
    srr.display_order, -- Note: ensure display_order exists in your table, otherwise remove this line
    sa.is_lead DESC NULLS LAST,
    r.name;
END;
$$;
