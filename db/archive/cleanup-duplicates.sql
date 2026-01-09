-- =====================================================
-- Cleanup Duplicate Service Groups
-- Keeps the OLDEST group for each date/name combo
-- =====================================================

BEGIN;

-- Show what we'll delete
SELECT 
    'WILL DELETE' as action,
    sg.group_date,
    sg.name,
    sg.id,
    COUNT(si.id) as instance_count,
    sg.created_at
FROM service_groups sg
LEFT JOIN service_instances si ON si.service_group_id = sg.id
WHERE sg.org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
  AND sg.id NOT IN (
    -- Keep only the oldest group for each date/name
    SELECT MIN(id) 
    FROM service_groups 
    WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
    GROUP BY group_date, name
  )
GROUP BY sg.id, sg.group_date, sg.name, sg.created_at
ORDER BY sg.group_date DESC, sg.name;

-- Delete duplicate service instances (CASCADE will handle this)
-- Delete duplicate service groups (keeps oldest per date/name)
DELETE FROM service_groups
WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
  AND id NOT IN (
    SELECT MIN(id) 
    FROM service_groups 
    WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
    GROUP BY group_date, name
  );

-- Show what we kept
SELECT 
    'KEPT' as action,
    sg.group_date,
    sg.name,
    sg.id,
    COUNT(si.id) as instance_count,
    sg.created_at
FROM service_groups sg
LEFT JOIN service_instances si ON si.service_group_id = sg.id
WHERE sg.org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
GROUP BY sg.id, sg.group_date, sg.name, sg.created_at
ORDER BY sg.group_date DESC, sg.name;

COMMIT;

-- Verify final state
SELECT 
    sg.group_date,
    sg.name as service_name,
    si.service_time,
    c.name as campus_name
FROM service_groups sg
JOIN service_instances si ON si.service_group_id = sg.id
LEFT JOIN campuses c ON si.campus_id = c.id
WHERE sg.org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
ORDER BY sg.group_date DESC, c.name NULLS FIRST, si.service_time;
