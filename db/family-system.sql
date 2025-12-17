-- =====================================================
-- FAMILY MANAGEMENT SYSTEM
-- Supports traditional families, foster care, and
-- flexible household relationships
-- =====================================================

-- ==========================================
-- FAMILIES TABLE
-- Represents a household unit
-- ==========================================
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, -- "The Wikene Family", "Miller Household", etc.
  primary_address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_families_org ON families(org_id);
CREATE INDEX idx_families_active ON families(org_id, is_active);

COMMENT ON TABLE families IS 'Represents households/family units';
COMMENT ON COLUMN families.name IS 'Display name for the family unit';
COMMENT ON COLUMN families.primary_address_id IS 'Optional link to primary family address';

-- ==========================================
-- FAMILY MEMBERS TABLE
-- Links people to families with relationships
-- ==========================================
CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  
  -- Relationship type
  relationship text NOT NULL, -- 'parent', 'child', 'foster_child', 'guardian', 'spouse', 'other'
  
  -- For foster/temporary placements
  start_date date,
  end_date date,
  is_temporary boolean DEFAULT false NOT NULL,
  
  -- Status
  is_active boolean DEFAULT true NOT NULL,
  is_primary_contact boolean DEFAULT false NOT NULL, -- Who to call first for this family
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT fm_org_family_person_uniq UNIQUE(org_id, family_id, person_id),
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_person ON family_members(person_id);
CREATE INDEX idx_family_members_active ON family_members(family_id, is_active);
CREATE INDEX idx_family_members_relationship ON family_members(family_id, relationship);

COMMENT ON TABLE family_members IS 'Links people to families with relationship context';
COMMENT ON COLUMN family_members.relationship IS 'parent, child, foster_child, guardian, spouse, etc.';
COMMENT ON COLUMN family_members.is_temporary IS 'True for foster/temporary placements';
COMMENT ON COLUMN family_members.start_date IS 'When person joined family (useful for foster care)';
COMMENT ON COLUMN family_members.end_date IS 'When placement ended (triggers is_active=false)';
COMMENT ON COLUMN family_members.is_primary_contact IS 'Primary contact for family matters';

-- ==========================================
-- AUTO-DEACTIVATE TRIGGER
-- Automatically deactivate family members when end_date passes
-- ==========================================
CREATE OR REPLACE FUNCTION auto_deactivate_family_member()
RETURNS TRIGGER AS $$
BEGIN
  -- If end_date is set and is in the past, set is_active to false
  IF NEW.end_date IS NOT NULL AND NEW.end_date <= CURRENT_DATE THEN
    NEW.is_active := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_deactivate_family_member
  BEFORE INSERT OR UPDATE ON family_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_deactivate_family_member();

COMMENT ON FUNCTION auto_deactivate_family_member IS 'Automatically sets is_active=false when end_date passes';

-- ==========================================
-- FUNCTION: Get family roster
-- ==========================================
CREATE OR REPLACE FUNCTION get_family_roster(p_family_id uuid)
RETURNS TABLE (
  person_id uuid,
  display_name text,
  relationship text,
  is_active boolean,
  is_temporary boolean,
  start_date date,
  end_date date,
  is_primary_contact boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    fm.relationship,
    fm.is_active,
    fm.is_temporary,
    fm.start_date,
    fm.end_date,
    fm.is_primary_contact
  FROM family_members fm
  JOIN people p ON p.id = fm.person_id
  WHERE fm.family_id = p_family_id
  ORDER BY 
    CASE fm.relationship
      WHEN 'parent' THEN 1
      WHEN 'guardian' THEN 2
      WHEN 'spouse' THEN 3
      WHEN 'child' THEN 4
      WHEN 'foster_child' THEN 5
      ELSE 6
    END,
    p.display_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_family_roster IS 'Returns all family members with relationship details, ordered by relationship type';

-- ==========================================
-- FUNCTION: Get active children for check-in
-- Only returns children who can currently be checked in
-- ==========================================
CREATE OR REPLACE FUNCTION get_checkable_children(p_family_id uuid)
RETURNS TABLE (
  person_id uuid,
  display_name text,
  relationship text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    fm.relationship
  FROM family_members fm
  JOIN people p ON p.id = fm.person_id
  WHERE fm.family_id = p_family_id
    AND fm.is_active = true
    AND fm.relationship IN ('child', 'foster_child')
    AND (fm.end_date IS NULL OR fm.end_date > CURRENT_DATE)
  ORDER BY p.display_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_checkable_children IS 'Returns only active children eligible for check-in';

-- ==========================================
-- VIEW: Family summary
-- ==========================================
CREATE OR REPLACE VIEW v_family_summary AS
SELECT 
  f.id as family_id,
  f.org_id,
  f.name as family_name,
  f.is_active,
  COUNT(DISTINCT fm.person_id) FILTER (WHERE fm.is_active = true) as active_members,
  COUNT(DISTINCT fm.person_id) FILTER (WHERE fm.relationship IN ('child', 'foster_child') AND fm.is_active = true) as active_children,
  COUNT(DISTINCT fm.person_id) FILTER (WHERE fm.relationship = 'foster_child' AND fm.is_active = true) as active_foster_children,
  array_agg(DISTINCT p.display_name ORDER BY p.display_name) FILTER (WHERE fm.is_primary_contact = true) as primary_contacts
FROM families f
LEFT JOIN family_members fm ON fm.family_id = f.id
LEFT JOIN people p ON p.id = fm.person_id AND fm.is_primary_contact = true
GROUP BY f.id, f.org_id, f.name, f.is_active;

COMMENT ON VIEW v_family_summary IS 'Quick overview of family composition';

-- ==========================================
-- SAMPLE DATA
-- ==========================================

-- The Wikene Family (with foster children)
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_wikene_family_id uuid;
  v_brian_id uuid;
  v_heather_id uuid;
  v_elijah_id uuid;
  v_aj_id uuid;
  v_sabrina_id uuid;
  v_address_id uuid;
BEGIN
  -- Get person IDs
  SELECT id INTO v_brian_id FROM people WHERE org_id = v_org_id AND display_name = 'Brian Wikene';
  SELECT id INTO v_heather_id FROM people WHERE org_id = v_org_id AND display_name = 'Heather Wikene';
  
  -- Create Elijah (11-year-old)
  INSERT INTO people (org_id, display_name)
  VALUES (v_org_id, 'Elijah Wikene')
  RETURNING id INTO v_elijah_id;
  
  -- Create foster children
  INSERT INTO people (org_id, display_name)
  VALUES 
    (v_org_id, 'AJ'),
    (v_org_id, 'Sabrina')
  RETURNING id INTO v_aj_id;
  
  SELECT id INTO v_sabrina_id FROM people WHERE org_id = v_org_id AND display_name = 'Sabrina';
  
  -- Get the Auburn address
  SELECT id INTO v_address_id 
  FROM addresses 
  WHERE person_id = v_brian_id 
  AND city = 'Auburn'
  LIMIT 1;
  
  -- Create family
  INSERT INTO families (org_id, name, primary_address_id, notes)
  VALUES (
    v_org_id,
    'The Wikene Family',
    v_address_id,
    'Foster care family. AJ and Sabrina may trial with grandmother soon.'
  )
  RETURNING id INTO v_wikene_family_id;
  
  -- Add family members
  INSERT INTO family_members (org_id, family_id, person_id, relationship, is_primary_contact, is_temporary)
  VALUES
    (v_org_id, v_wikene_family_id, v_brian_id, 'parent', true, false),
    (v_org_id, v_wikene_family_id, v_heather_id, 'parent', true, false),
    (v_org_id, v_wikene_family_id, v_elijah_id, 'child', false, false),
    (v_org_id, v_wikene_family_id, v_aj_id, 'foster_child', false, true),
    (v_org_id, v_wikene_family_id, v_sabrina_id, 'foster_child', false, true);
  
  -- Note: AJ and Sabrina don't have end_date yet because placement is ongoing
  -- When they move to grandma, you'd UPDATE to set end_date
  
  RAISE NOTICE 'Created Wikene family with % members', (
    SELECT COUNT(*) FROM family_members WHERE family_id = v_wikene_family_id
  );
END $$;

-- Example: Add the Miller family (James Wilson's family)
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_miller_family_id uuid;
  v_david_id uuid;
  v_sarah_id uuid;
  v_grace_id uuid;
  v_address_id uuid;
BEGIN
  -- Get David Miller ID
  SELECT id INTO v_david_id FROM people WHERE org_id = v_org_id AND display_name = 'David Miller';
  
  -- Create spouse and child
  INSERT INTO people (org_id, display_name)
  VALUES 
    (v_org_id, 'Sarah Miller'),
    (v_org_id, 'Grace Miller');
  
  SELECT id INTO v_sarah_id FROM people WHERE org_id = v_org_id AND display_name = 'Sarah Miller';
  SELECT id INTO v_grace_id FROM people WHERE org_id = v_org_id AND display_name = 'Grace Miller';
  
  -- Get David's address (we need to add one first)
  INSERT INTO addresses (org_id, person_id, street, city, state, postal_code, label)
  VALUES (v_org_id, v_david_id, '892 Maple Avenue', 'Federal Way', 'WA', '98003', 'Home')
  RETURNING id INTO v_address_id;
  
  -- Create family
  INSERT INTO families (org_id, name, primary_address_id)
  VALUES (v_org_id, 'The Miller Family', v_address_id)
  RETURNING id INTO v_miller_family_id;
  
  -- Add members
  INSERT INTO family_members (org_id, family_id, person_id, relationship, is_primary_contact)
  VALUES
    (v_org_id, v_miller_family_id, v_david_id, 'parent', true),
    (v_org_id, v_miller_family_id, v_sarah_id, 'parent', true),
    (v_org_id, v_miller_family_id, v_grace_id, 'child', false);
END $$;

COMMIT;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- View all families
SELECT * FROM v_family_summary ORDER BY family_name;

-- View Wikene family roster
SELECT * FROM get_family_roster(
  (SELECT id FROM families WHERE name = 'The Wikene Family')
);

-- View checkable children for Wikene family
SELECT * FROM get_checkable_children(
  (SELECT id FROM families WHERE name = 'The Wikene Family')
);
