-- /db/archive/complete-scheduling-setup.sql
-- =====================================================
-- COMPLETE SERVICE SCHEDULING SETUP
-- Creates tables, then populates all roles and requirements
-- =====================================================

-- ==========================================
-- STEP 1: Add missing columns to roles table
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' AND column_name = 'ministry_area'
  ) THEN
    ALTER TABLE roles ADD COLUMN ministry_area text;
    RAISE NOTICE '✓ Added ministry_area column to roles table';
  ELSE
    RAISE NOTICE '  ministry_area column already exists';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' AND column_name = 'description'
  ) THEN
    ALTER TABLE roles ADD COLUMN description text;
    RAISE NOTICE '✓ Added description column to roles table';
  ELSE
    RAISE NOTICE '  description column already exists';
  END IF;
END $$;

-- ==========================================
-- STEP 2: Create service_assignments table
-- ==========================================
CREATE TABLE IF NOT EXISTS service_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  service_instance_id uuid NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(id) ON DELETE SET NULL,
  
  status text NOT NULL DEFAULT 'pending',
  is_lead boolean DEFAULT false,
  
  assigned_at timestamptz DEFAULT now() NOT NULL,
  assigned_by uuid REFERENCES people(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  notes text,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT sa_org_instance_role_person_uniq UNIQUE(org_id, service_instance_id, role_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_service_assignments_instance ON service_assignments(service_instance_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_person ON service_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_role ON service_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_status ON service_assignments(service_instance_id, status);

-- ==========================================
-- STEP 3: Create helper views and functions
-- ==========================================

-- View: Service Assignment Summary
CREATE OR REPLACE VIEW v_service_assignment_summary AS
SELECT 
  si.id as service_instance_id,
  sg.group_date,
  sg.name as service_name,
  si.service_time,
  c.name as campus_name,
  
  COUNT(DISTINCT srr.role_id) as total_positions,
  COUNT(DISTINCT sa.id) FILTER (WHERE sa.person_id IS NOT NULL) as filled_positions,
  COUNT(DISTINCT sa.id) FILTER (WHERE sa.status = 'confirmed') as confirmed_assignments,
  COUNT(DISTINCT sa.id) FILTER (WHERE sa.status = 'pending') as pending_confirmations,
  COUNT(DISTINCT sa.id) FILTER (WHERE sa.status = 'declined') as declined_assignments,
  COUNT(DISTINCT srr.role_id) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 FROM service_assignments sa2 
      WHERE sa2.service_instance_id = si.id 
      AND sa2.role_id = srr.role_id
      AND sa2.person_id IS NOT NULL
    )
  ) as unfilled_positions

FROM service_instances si
JOIN service_groups sg ON sg.id = si.service_group_id
LEFT JOIN campuses c ON c.id = si.campus_id
LEFT JOIN service_role_requirements srr ON srr.context_id = sg.context_id
LEFT JOIN service_assignments sa ON sa.service_instance_id = si.id AND sa.role_id = srr.role_id
GROUP BY si.id, sg.group_date, sg.name, si.service_time, c.name;

-- Function: Get Service Roster
CREATE OR REPLACE FUNCTION get_service_roster(p_service_instance_id uuid)
RETURNS TABLE (
  ministry_area text,
  role_name text,
  role_id uuid,
  person_id uuid,
  person_name text,
  status text,
  is_lead boolean,
  is_required boolean,
  notes text
) AS $$
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
    srr.is_required,
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
$$ LANGUAGE plpgsql;

-- ==========================================
-- STEP 4: Populate all roles
-- ==========================================
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_sunday_am_id uuid;
BEGIN
  -- Get Sunday AM context
  SELECT id INTO v_sunday_am_id FROM contexts WHERE org_id = v_org_id AND name = 'Sunday AM';
  
  -- Clean slate
  DELETE FROM service_assignments WHERE org_id = v_org_id;
  DELETE FROM service_role_requirements WHERE org_id = v_org_id;
  DELETE FROM roles WHERE org_id = v_org_id;
  
  -- WORSHIP TEAM
  INSERT INTO roles (org_id, name, ministry_area, description) VALUES 
    (v_org_id, 'Worship Leader', 'Worship', 'Leads congregational worship'),
    (v_org_id, 'Acoustic Guitar', 'Worship', 'Acoustic guitar player'),
    (v_org_id, 'Electric Guitar', 'Worship', 'Electric guitar player'),
    (v_org_id, 'Bass Guitar', 'Worship', 'Bass guitar player'),
    (v_org_id, 'Drums', 'Worship', 'Drummer'),
    (v_org_id, 'Piano', 'Worship', 'Piano/Keys player'),
    (v_org_id, 'Keys/Synth', 'Worship', 'Keyboard/Synthesizer'),
    (v_org_id, 'Percussion', 'Worship', 'Percussion instruments'),
    (v_org_id, 'Background Vocals', 'Worship', 'Backup singer/vocalist');
  
  -- TECH TEAM
  INSERT INTO roles (org_id, name, ministry_area, description) VALUES 
    (v_org_id, 'FOH Audio', 'Tech', 'Front of House audio engineer'),
    (v_org_id, 'Livestream Audio', 'Tech', 'Livestream audio mix engineer'),
    (v_org_id, 'Lyrics (ProPresenter)', 'Tech', 'Lyrics and slides operator'),
    (v_org_id, 'Video Producer', 'Tech', 'Remote camera control and livestream production');
  
  -- PRAYER TEAM
  INSERT INTO roles (org_id, name, ministry_area, description) VALUES 
    (v_org_id, 'Prayer Team', 'Prayer', 'Available for prayer ministry');
  
  -- HOSPITALITY
  INSERT INTO roles (org_id, name, ministry_area, description) VALUES 
    (v_org_id, 'Greeter', 'Hospitality', 'Welcome people at doors'),
    (v_org_id, 'Hospitality', 'Hospitality', 'Coffee, snacks, general hospitality');
  
  -- KIDS MINISTRY
  INSERT INTO roles (org_id, name, ministry_area, description) VALUES 
    (v_org_id, 'Nursery', 'Kids Ministry', 'Nursery worker (infants)'),
    (v_org_id, 'Toddlers', 'Kids Ministry', 'Toddlers classroom worker'),
    (v_org_id, 'BaseCamp', 'Kids Ministry', 'BaseCamp (elementary) leader/helper'),
    (v_org_id, 'Kids Check-in', 'Kids Ministry', 'Check-in/check-out overseer');
  
  -- YOUTH
  INSERT INTO roles (org_id, name, ministry_area, description) VALUES 
    (v_org_id, 'Youth Leader', 'Youth', 'Youth group leader');
  
  RAISE NOTICE '✓ Created % roles', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id);
END $$;

-- ==========================================
-- STEP 5: Set up Sunday AM requirements
-- ==========================================
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_sunday_am_id uuid;
BEGIN
  SELECT id INTO v_sunday_am_id FROM contexts WHERE org_id = v_org_id AND name = 'Sunday AM';
  
  INSERT INTO service_role_requirements (org_id, context_id, role_id, min_needed, max_needed, is_required, display_order)
  SELECT 
    v_org_id,
    v_sunday_am_id,
    r.id,
    CASE r.name
      WHEN 'Worship Leader' THEN 1
      WHEN 'Background Vocals' THEN 1
      WHEN 'Drums' THEN 1
      WHEN 'Bass Guitar' THEN 1
      WHEN 'Acoustic Guitar' THEN 0
      WHEN 'Electric Guitar' THEN 0
      WHEN 'Piano' THEN 0
      WHEN 'Keys/Synth' THEN 0
      WHEN 'Percussion' THEN 0
      WHEN 'FOH Audio' THEN 1
      WHEN 'Livestream Audio' THEN 1
      WHEN 'Lyrics (ProPresenter)' THEN 1
      WHEN 'Video Producer' THEN 1
      WHEN 'Prayer Team' THEN 3
      WHEN 'Greeter' THEN 4
      WHEN 'Hospitality' THEN 1
      WHEN 'Nursery' THEN 2
      WHEN 'Toddlers' THEN 2
      WHEN 'BaseCamp' THEN 2
      WHEN 'Kids Check-in' THEN 1
      WHEN 'Youth Leader' THEN 1
    END as min_needed,
    CASE r.name
      WHEN 'Worship Leader' THEN 2
      WHEN 'Background Vocals' THEN 2
      WHEN 'Drums' THEN 1
      WHEN 'Bass Guitar' THEN 1
      WHEN 'Acoustic Guitar' THEN 2
      WHEN 'Electric Guitar' THEN 2
      WHEN 'Piano' THEN 1
      WHEN 'Keys/Synth' THEN 1
      WHEN 'Percussion' THEN 1
      WHEN 'FOH Audio' THEN 1
      WHEN 'Livestream Audio' THEN 1
      WHEN 'Lyrics (ProPresenter)' THEN 1
      WHEN 'Video Producer' THEN 1
      WHEN 'Prayer Team' THEN 5
      WHEN 'Greeter' THEN 4
      WHEN 'Hospitality' THEN 2
      WHEN 'Nursery' THEN 2
      WHEN 'Toddlers' THEN 2
      WHEN 'BaseCamp' THEN 2
      WHEN 'Kids Check-in' THEN 1
      WHEN 'Youth Leader' THEN 1
    END as max_needed,
    CASE WHEN r.name IN ('Acoustic Guitar', 'Electric Guitar', 'Piano', 'Keys/Synth', 'Percussion') 
         THEN false ELSE true END as is_required,
    ROW_NUMBER() OVER (ORDER BY r.ministry_area, r.name) as display_order
  FROM roles r
  WHERE r.org_id = v_org_id;
  
  RAISE NOTICE '✓ Created % requirements for Sunday AM', (SELECT COUNT(*) FROM service_role_requirements WHERE context_id = v_sunday_am_id);
END $$;

-- Show summary
SELECT 
  ministry_area,
  COUNT(*) as role_count,
  string_agg(name, ', ' ORDER BY name) as roles
FROM roles 
WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
GROUP BY ministry_area
ORDER BY ministry_area;
