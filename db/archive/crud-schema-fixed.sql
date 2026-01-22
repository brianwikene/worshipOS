-- /db/archive/crud-schema-fixed.sql
-- =====================================================
-- SCHEMA ADDITIONS FOR CRUD OPERATIONS (FIXED)
-- Adds missing columns then creates views/functions
-- =====================================================

-- ==========================================
-- Add is_active columns for soft deletes
-- ==========================================
DO $$
BEGIN
  -- People soft delete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'people' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE people ADD COLUMN is_active boolean DEFAULT true;
    CREATE INDEX idx_people_active ON people(org_id, is_active);
    RAISE NOTICE '✓ Added is_active to people';
  ELSE
    RAISE NOTICE '  is_active already exists on people';
  END IF;

  -- Roles soft delete  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE roles ADD COLUMN is_active boolean DEFAULT true;
    CREATE INDEX idx_roles_active ON roles(org_id, is_active);
    RAISE NOTICE '✓ Added is_active to roles';
  ELSE
    RAISE NOTICE '  is_active already exists on roles';
  END IF;

  -- Add updated_at to people if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'people' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE people ADD COLUMN updated_at timestamptz DEFAULT now();
    RAISE NOTICE '✓ Added updated_at to people';
  ELSE
    RAISE NOTICE '  updated_at already exists on people';
  END IF;
END $$;

-- ==========================================
-- Add missing columns to service_role_requirements
-- ==========================================
DO $$
BEGIN
  -- Add display_order column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_role_requirements' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE service_role_requirements ADD COLUMN display_order int DEFAULT 0;
    RAISE NOTICE '✓ Added display_order to service_role_requirements';
  ELSE
    RAISE NOTICE '  display_order already exists on service_role_requirements';
  END IF;
END $$;

-- ==========================================
-- Add missing columns to songs table
-- ==========================================
DO $$
BEGIN
  -- Add artist column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'artist'
  ) THEN
    ALTER TABLE songs ADD COLUMN artist text;
    RAISE NOTICE '✓ Added artist to songs';
  ELSE
    RAISE NOTICE '  artist already exists on songs';
  END IF;

  -- Add key column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'key'
  ) THEN
    ALTER TABLE songs ADD COLUMN key text;
    RAISE NOTICE '✓ Added key to songs';
  ELSE
    RAISE NOTICE '  key already exists on songs';
  END IF;

  -- Add bpm column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'bpm'
  ) THEN
    ALTER TABLE songs ADD COLUMN bpm int;
    RAISE NOTICE '✓ Added bpm to songs';
  ELSE
    RAISE NOTICE '  bpm already exists on songs';
  END IF;

  -- Rename ccli_id to ccli_number for consistency
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'ccli_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'ccli_number'
  ) THEN
    ALTER TABLE songs RENAME COLUMN ccli_id TO ccli_number;
    RAISE NOTICE '✓ Renamed ccli_id to ccli_number';
  ELSE
    RAISE NOTICE '  ccli_number already exists on songs';
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'notes'
  ) THEN
    ALTER TABLE songs ADD COLUMN notes text;
    RAISE NOTICE '✓ Added notes to songs';
  ELSE
    RAISE NOTICE '  notes already exists on songs';
  END IF;
END $$;

-- ==========================================
-- SERVICE_INSTANCE_SONGS Junction Table
-- Links songs to specific service instances
-- ==========================================
CREATE TABLE IF NOT EXISTS service_instance_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_instance_id uuid NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  
  -- Song details for this specific service
  display_order int NOT NULL,
  key text, -- Override default key if needed (e.g., "C" instead of "G")
  notes text, -- "Extended bridge", "Skip verse 2", etc.
  
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_service_song_order UNIQUE(service_instance_id, display_order)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_service_instance_songs_instance') THEN
    CREATE INDEX idx_service_instance_songs_instance ON service_instance_songs(service_instance_id);
    RAISE NOTICE '✓ Created index on service_instance_songs.service_instance_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_service_instance_songs_song') THEN
    CREATE INDEX idx_service_instance_songs_song ON service_instance_songs(song_id);
    RAISE NOTICE '✓ Created index on service_instance_songs.song_id';
  END IF;
END $$;

COMMENT ON TABLE service_instance_songs IS 'Songs included in each service instance (the setlist)';
COMMENT ON COLUMN service_instance_songs.key IS 'Override key for this service (e.g., transpose from G to C)';

-- ==========================================
-- UPDATE: get_service_roster function
-- Use min_needed > 0 to calculate is_required
-- ==========================================
CREATE OR REPLACE FUNCTION get_service_roster(p_service_instance_id uuid)
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
    (srr.min_needed > 0) as is_required, -- Calculate from min_needed
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
    srr.display_order,
    sa.is_lead DESC NULLS LAST,
    r.name;
END;
$$;

-- ==========================================
-- QUERY: Get all required roles for a context
-- Shows what's needed vs what's optional
-- ==========================================
CREATE OR REPLACE VIEW v_context_role_requirements AS
SELECT 
  c.id as context_id,
  c.name as context_name,
  r.id as role_id,
  r.name as role_name,
  r.ministry_area,
  srr.min_needed,
  srr.max_needed,
  (srr.min_needed > 0) as is_required, -- Calculate from min_needed
  srr.display_order,
  CASE 
    WHEN srr.min_needed > 0 THEN '✓ Required'
    ELSE 'Optional'
  END as requirement_status
FROM contexts c
JOIN service_role_requirements srr ON srr.context_id = c.id
JOIN roles r ON r.id = srr.role_id
ORDER BY c.name, r.ministry_area, srr.display_order, r.name;

COMMENT ON VIEW v_context_role_requirements IS 'Shows which roles are required vs optional for each service type';

-- ==========================================
-- QUERY: Service staffing status with is_required flag
-- ==========================================
CREATE OR REPLACE VIEW v_service_staffing_detail AS
SELECT 
  si.id as service_instance_id,
  sg.group_date,
  sg.name as service_name,
  si.service_time,
  
  r.id as role_id,
  r.name as role_name,
  r.ministry_area,
  
  srr.min_needed,
  srr.max_needed,
  (srr.min_needed > 0) as is_required, -- Calculate from min_needed
  
  COUNT(sa.id) FILTER (WHERE sa.person_id IS NOT NULL) as filled_count,
  COUNT(sa.id) FILTER (WHERE sa.status = 'confirmed') as confirmed_count,
  COUNT(sa.id) FILTER (WHERE sa.status = 'pending' AND sa.person_id IS NOT NULL) as pending_count,
  
  CASE 
    WHEN srr.min_needed > 0 AND COUNT(sa.id) FILTER (WHERE sa.person_id IS NOT NULL) < srr.min_needed 
      THEN '🔴 UNFILLED'
    WHEN COUNT(sa.id) FILTER (WHERE sa.status = 'pending' AND sa.person_id IS NOT NULL) > 0 
      THEN '🟡 PENDING'
    WHEN COUNT(sa.id) FILTER (WHERE sa.status = 'confirmed') >= srr.min_needed 
      THEN '🟢 STAFFED'
    ELSE '⚪ OPTIONAL'
  END as status

FROM service_instances si
JOIN service_groups sg ON sg.id = si.service_group_id
JOIN service_role_requirements srr ON srr.context_id = sg.context_id
JOIN roles r ON r.id = srr.role_id
LEFT JOIN service_assignments sa ON sa.service_instance_id = si.id AND sa.role_id = r.id
GROUP BY 
  si.id, sg.group_date, sg.name, si.service_time,
  r.id, r.name, r.ministry_area,
  srr.min_needed, srr.max_needed
ORDER BY 
  sg.group_date DESC, si.service_time, 
  r.ministry_area, r.name;

COMMENT ON VIEW v_service_staffing_detail IS 'Shows staffing status for each role in each service with is_required flag';

-- ==========================================
-- FUNCTION: Copy service to another date
-- Copies assignments, songs, segments from one service to another
-- ==========================================
CREATE OR REPLACE FUNCTION copy_service_to_date(
  p_source_instance_id uuid,
  p_target_date date,
  p_target_time time,
  p_org_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_source_service record;
  v_target_group_id uuid;
  v_target_instance_id uuid;
  v_context_id uuid;
  v_campus_id uuid;
  v_copied_assignments int := 0;
  v_copied_songs int := 0;
  v_copied_segments int := 0;
BEGIN
  -- Get source service info
  SELECT si.*, sg.context_id, sg.name as group_name
  INTO v_source_service
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE si.id = p_source_instance_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source service not found';
  END IF;
  
  -- Get or create target service group
  INSERT INTO service_groups (org_id, group_date, name, context_id)
  VALUES (p_org_id, p_target_date, v_source_service.group_name, v_source_service.context_id)
  ON CONFLICT (org_id, group_date, name) DO UPDATE SET org_id = EXCLUDED.org_id
  RETURNING id INTO v_target_group_id;
  
  -- Get or create target service instance
  INSERT INTO service_instances (service_group_id, service_time, campus_id)
  VALUES (v_target_group_id, p_target_time, v_source_service.campus_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_target_instance_id;
  
  IF v_target_instance_id IS NULL THEN
    SELECT id INTO v_target_instance_id
    FROM service_instances
    WHERE service_group_id = v_target_group_id AND service_time = p_target_time;
  END IF;
  
  -- Copy assignments (only the roles, not the specific people)
  INSERT INTO service_assignments (org_id, service_instance_id, role_id, person_id, status, is_lead, notes)
  SELECT 
    p_org_id,
    v_target_instance_id,
    role_id,
    NULL, -- Don't copy the person, just the slot
    'pending',
    is_lead,
    notes
  FROM service_assignments
  WHERE service_instance_id = p_source_instance_id
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_copied_assignments = ROW_COUNT;
  
  -- Copy songs
  INSERT INTO service_instance_songs (service_instance_id, song_id, display_order, key, notes)
  SELECT 
    v_target_instance_id,
    song_id,
    display_order,
    key,
    notes
  FROM service_instance_songs
  WHERE service_instance_id = p_source_instance_id
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_copied_songs = ROW_COUNT;
  
  -- Copy segments
  INSERT INTO service_segments (org_id, service_instance_id, name, segment_type, start_time, duration_minutes, display_order, notes)
  SELECT 
    p_org_id,
    v_target_instance_id,
    name,
    segment_type,
    start_time,
    duration_minutes,
    display_order,
    notes
  FROM service_segments
  WHERE service_instance_id = p_source_instance_id
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_copied_segments = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'source_instance_id', p_source_instance_id,
    'target_instance_id', v_target_instance_id,
    'target_date', p_target_date,
    'target_time', p_target_time,
    'copied_assignments', v_copied_assignments,
    'copied_songs', v_copied_songs,
    'copied_segments', v_copied_segments
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION copy_service_to_date IS 'Copy service structure (roles, songs, segments) to a new date for easy week-to-week planning';

-- ==========================================
-- SAMPLE DATA: Add some songs
-- ==========================================
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
BEGIN
  -- Add common worship songs
  INSERT INTO songs (org_id, title, artist, key, bpm, ccli_number) VALUES
    (v_org_id, 'Way Maker', 'Sinach', 'G', 72, '7115744'),
    (v_org_id, 'Goodness of God', 'Bethel Music', 'A', 138, '7117726'),
    (v_org_id, 'Great Are You Lord', 'All Sons & Daughters', 'C', 75, '6460220'),
    (v_org_id, 'Reckless Love', 'Cory Asbury', 'G', 68, '7089641'),
    (v_org_id, 'Living Hope', 'Phil Wickham', 'C', 73, '7106807')
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '✓ Added sample songs';
END $$;

COMMIT;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Show all required roles for Sunday AM
SELECT * FROM v_context_role_requirements 
WHERE context_name = 'Sunday AM' 
ORDER BY ministry_area, role_name;

-- Show staffing detail for a specific service
SELECT * FROM v_service_staffing_detail
WHERE service_instance_id = (
  SELECT si.id FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE sg.group_date = '2025-12-21' AND si.service_time = '09:00:00'
  LIMIT 1
);
