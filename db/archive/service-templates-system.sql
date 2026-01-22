-- /db/archive/service-templates-system.sql
-- =====================================================
-- SERVICE TEMPLATES SYSTEM
-- Pattern (Template) vs Event (Service Instance)
-- =====================================================

-- ==========================================
-- SERVICE TEMPLATES (The Pattern/Stamp)
-- ==========================================
CREATE TABLE service_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  
  -- Template identity
  name text NOT NULL, -- "Standard Sunday", "Communion Sunday", "Worship Night"
  description text,
  context_id uuid REFERENCES contexts(id), -- Which service type (Sunday AM, Wed Night, etc)
  
  -- Default timing
  default_start_time time, -- "10:30 AM"
  default_duration_minutes int DEFAULT 90,
  
  -- Structure stored as JSON for flexibility
  structure jsonb, -- The segments and their details
  
  -- Template metadata
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false, -- Default template for this context
  
  created_by uuid REFERENCES people(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_org_template_name UNIQUE(org_id, name)
);

CREATE INDEX idx_service_templates_org ON service_templates(org_id);
CREATE INDEX idx_service_templates_context ON service_templates(context_id);
CREATE INDEX idx_service_templates_default ON service_templates(org_id, is_default) WHERE is_default = true;

COMMENT ON TABLE service_templates IS 'The reusable patterns/stamps for services';
COMMENT ON COLUMN service_templates.structure IS 'JSON structure of segments, roles, and details';

-- ==========================================
-- EXAMPLE TEMPLATE STRUCTURES
-- ==========================================

-- Standard Sunday Template Structure:
/*
{
  "segments": [
    {
      "order": 1,
      "name": "Pre-Service Prayer",
      "type": "prayer",
      "relative_start_minutes": -15,
      "duration_minutes": 10,
      "roles": [
        {"role_name": "Prayer Team", "min": 3, "max": 5}
      ]
    },
    {
      "order": 2,
      "name": "Worship Set 1",
      "type": "worship",
      "relative_start_minutes": 0,
      "duration_minutes": 25,
      "roles": [
        {"role_name": "Worship Leader", "min": 1, "max": 2, "notes": "Can co-lead"},
        {"role_name": "Drums", "min": 1, "max": 1},
        {"role_name": "Bass Guitar", "min": 1, "max": 1},
        {"role_name": "Acoustic Guitar", "min": 0, "max": 2},
        {"role_name": "Electric Guitar", "min": 0, "max": 1},
        {"role_name": "Piano", "min": 0, "max": 1},
        {"role_name": "Background Vocals", "min": 1, "max": 2}
      ],
      "notes": "High energy, full band"
    },
    {
      "order": 3,
      "name": "Welcome & Announcements",
      "type": "transition",
      "relative_start_minutes": 25,
      "duration_minutes": 5,
      "roles": [
        {"role_name": "Lyrics (ProPresenter)", "min": 1, "max": 1}
      ]
    },
    {
      "order": 4,
      "name": "Sermon",
      "type": "teaching",
      "relative_start_minutes": 30,
      "duration_minutes": 35,
      "roles": [
        {"role_name": "Lyrics (ProPresenter)", "min": 1, "max": 1}
      ]
    },
    {
      "order": 5,
      "name": "Response Worship",
      "type": "worship",
      "relative_start_minutes": 65,
      "duration_minutes": 15,
      "roles": [
        {"role_name": "Worship Leader", "min": 1, "max": 1},
        {"role_name": "Acoustic Guitar", "min": 0, "max": 1},
        {"role_name": "Piano", "min": 0, "max": 1},
        {"role_name": "Background Vocals", "min": 0, "max": 1}
      ],
      "notes": "Intimate, reflective - minimal instrumentation"
    }
  ],
  "tech_requirements": [
    {"role_name": "FOH Audio", "all_segments": true},
    {"role_name": "Livestream Audio", "all_segments": true},
    {"role_name": "Video Producer", "all_segments": true}
  ],
  "hospitality_requirements": [
    {"role_name": "Greeter", "count": 4, "timing": "pre_service"},
    {"role_name": "Hospitality", "count": 2, "timing": "pre_service"}
  ],
  "kids_ministry_requirements": [
    {"role_name": "Kids Check-in", "count": 1},
    {"role_name": "Nursery", "count": 2},
    {"role_name": "Toddlers", "count": 2},
    {"role_name": "BaseCamp", "count": 2}
  ]
}
*/

-- ==========================================
-- SAMPLE TEMPLATES
-- ==========================================
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_sunday_am_id uuid;
  v_wednesday_id uuid;
BEGIN
  -- Get contexts
  SELECT id INTO v_sunday_am_id FROM contexts WHERE org_id = v_org_id AND name = 'Sunday AM';
  SELECT id INTO v_wednesday_id FROM contexts WHERE org_id = v_org_id AND name = 'Wednesday Night';
  
  -- Standard Sunday Template
  INSERT INTO service_templates (org_id, name, description, context_id, default_start_time, default_duration_minutes, is_default, structure)
  VALUES (
    v_org_id,
    'Standard Sunday',
    'Typical Sunday morning service with full band and kids ministry',
    v_sunday_am_id,
    '10:00:00',
    90,
    true,
    '{
      "segments": [
        {
          "order": 1,
          "name": "Pre-Service Prayer",
          "type": "prayer",
          "relative_start_minutes": -15,
          "duration_minutes": 10,
          "roles": [{"role_name": "Prayer Team", "min": 3, "max": 5}]
        },
        {
          "order": 2,
          "name": "Worship Set 1",
          "type": "worship",
          "relative_start_minutes": 0,
          "duration_minutes": 25,
          "roles": [
            {"role_name": "Worship Leader", "min": 1, "max": 2},
            {"role_name": "Drums", "min": 1, "max": 1},
            {"role_name": "Bass Guitar", "min": 1, "max": 1},
            {"role_name": "Background Vocals", "min": 1, "max": 2}
          ]
        },
        {
          "order": 3,
          "name": "Welcome",
          "type": "transition",
          "relative_start_minutes": 25,
          "duration_minutes": 5,
          "roles": []
        },
        {
          "order": 4,
          "name": "Sermon",
          "type": "teaching",
          "relative_start_minutes": 30,
          "duration_minutes": 35,
          "roles": []
        },
        {
          "order": 5,
          "name": "Response Worship",
          "type": "worship",
          "relative_start_minutes": 65,
          "duration_minutes": 15,
          "roles": [
            {"role_name": "Worship Leader", "min": 1, "max": 1},
            {"role_name": "Piano", "min": 0, "max": 1}
          ]
        }
      ],
      "all_service_roles": [
        {"role_name": "FOH Audio", "count": 1},
        {"role_name": "Livestream Audio", "count": 1},
        {"role_name": "Lyrics (ProPresenter)", "count": 1},
        {"role_name": "Video Producer", "count": 1},
        {"role_name": "Greeter", "count": 4},
        {"role_name": "Hospitality", "count": 2},
        {"role_name": "Kids Check-in", "count": 1},
        {"role_name": "Nursery", "count": 2},
        {"role_name": "Toddlers", "count": 2},
        {"role_name": "BaseCamp", "count": 2}
      ]
    }'::jsonb
  );
  
  -- Communion Sunday Template
  INSERT INTO service_templates (org_id, name, description, context_id, default_start_time, default_duration_minutes, structure)
  VALUES (
    v_org_id,
    'Communion Sunday',
    'First Sunday with communion included',
    v_sunday_am_id,
    '10:00:00',
    100,
    '{
      "segments": [
        {
          "order": 1,
          "name": "Worship Set 1",
          "type": "worship",
          "relative_start_minutes": 0,
          "duration_minutes": 25,
          "roles": [
            {"role_name": "Worship Leader", "min": 1, "max": 2},
            {"role_name": "Drums", "min": 1, "max": 1},
            {"role_name": "Bass Guitar", "min": 1, "max": 1}
          ]
        },
        {
          "order": 2,
          "name": "Communion",
          "type": "communion",
          "relative_start_minutes": 25,
          "duration_minutes": 15,
          "roles": [
            {"role_name": "Communion Team", "min": 4, "max": 6}
          ],
          "notes": "Worship continues softly during communion"
        },
        {
          "order": 3,
          "name": "Sermon",
          "type": "teaching",
          "relative_start_minutes": 40,
          "duration_minutes": 30,
          "roles": []
        },
        {
          "order": 4,
          "name": "Response Worship",
          "type": "worship",
          "relative_start_minutes": 70,
          "duration_minutes": 20,
          "roles": [
            {"role_name": "Worship Leader", "min": 1, "max": 1}
          ]
        }
      ],
      "all_service_roles": [
        {"role_name": "FOH Audio", "count": 1},
        {"role_name": "Livestream Audio", "count": 1},
        {"role_name": "Lyrics (ProPresenter)", "count": 1},
        {"role_name": "Video Producer", "count": 1},
        {"role_name": "Greeter", "count": 4},
        {"role_name": "Kids Check-in", "count": 1},
        {"role_name": "Nursery", "count": 2},
        {"role_name": "BaseCamp", "count": 2}
      ]
    }'::jsonb
  );
  
  -- Worship Night Template (Wednesday)
  INSERT INTO service_templates (org_id, name, description, context_id, default_start_time, default_duration_minutes, structure)
  VALUES (
    v_org_id,
    'Worship Night',
    'Wednesday evening focused worship with minimal production',
    v_wednesday_id,
    '19:00:00',
    75,
    '{
      "segments": [
        {
          "order": 1,
          "name": "Extended Worship",
          "type": "worship",
          "relative_start_minutes": 0,
          "duration_minutes": 45,
          "roles": [
            {"role_name": "Worship Leader", "min": 1, "max": 1},
            {"role_name": "Acoustic Guitar", "min": 1, "max": 2},
            {"role_name": "Piano", "min": 0, "max": 1},
            {"role_name": "Background Vocals", "min": 1, "max": 2}
          ],
          "notes": "Intimate, Spirit-led worship - minimal structure"
        },
        {
          "order": 2,
          "name": "Prayer Ministry",
          "type": "prayer",
          "relative_start_minutes": 45,
          "duration_minutes": 30,
          "roles": [
            {"role_name": "Prayer Team", "min": 5, "max": 8}
          ]
        }
      ],
      "all_service_roles": [
        {"role_name": "FOH Audio", "count": 1},
        {"role_name": "Lyrics (ProPresenter)", "count": 1}
      ]
    }'::jsonb
  );
  
  RAISE NOTICE '✓ Created 3 service templates';
END $$;

-- ==========================================
-- FUNCTION: Apply Template to Service Instance
-- ==========================================
CREATE OR REPLACE FUNCTION apply_template_to_service(
  p_template_id uuid,
  p_service_instance_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_template record;
  v_service record;
  v_segment jsonb;
  v_new_segment_id uuid;
  v_result jsonb;
  v_segment_count int := 0;
BEGIN
  -- Get template
  SELECT * INTO v_template 
  FROM service_templates 
  WHERE id = p_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', p_template_id;
  END IF;
  
  -- Get service instance
  SELECT si.*, sg.group_date 
  INTO v_service
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE si.id = p_service_instance_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service instance not found: %', p_service_instance_id;
  END IF;
  
  -- Create segments from template
  FOR v_segment IN 
    SELECT * FROM jsonb_array_elements(v_template.structure->'segments')
  LOOP
    -- Create service segment
    INSERT INTO service_segments (
      org_id,
      service_instance_id,
      name,
      segment_type,
      start_time,
      duration_minutes,
      display_order,
      notes
    )
    VALUES (
      v_service.org_id,
      p_service_instance_id,
      v_segment->>'name',
      v_segment->>'type',
      v_template.default_start_time + 
        ((v_segment->>'relative_start_minutes')::int || ' minutes')::interval,
      (v_segment->>'duration_minutes')::int,
      (v_segment->>'order')::int,
      v_segment->>'notes'
    )
    RETURNING id INTO v_new_segment_id;
    
    v_segment_count := v_segment_count + 1;
    
    -- TODO: Create segment role assignments based on v_segment->'roles'
    -- This would create placeholder assignments for each role
  END LOOP;
  
  v_result := jsonb_build_object(
    'template_id', p_template_id,
    'template_name', v_template.name,
    'service_instance_id', p_service_instance_id,
    'segments_created', v_segment_count,
    'success', true
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_template_to_service IS 'Stamps a template onto a specific service date';

-- ==========================================
-- FUNCTION: Save Service as New Template
-- ==========================================
CREATE OR REPLACE FUNCTION save_service_as_template(
  p_service_instance_id uuid,
  p_template_name text,
  p_description text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_service record;
  v_segments jsonb;
  v_new_template_id uuid;
BEGIN
  -- Get service info
  SELECT si.*, sg.context_id, sg.group_date
  INTO v_service
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE si.id = p_service_instance_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service instance not found: %', p_service_instance_id;
  END IF;
  
  -- Build structure from existing segments
  SELECT jsonb_build_object(
    'segments', jsonb_agg(
      jsonb_build_object(
        'order', display_order,
        'name', name,
        'type', segment_type,
        'relative_start_minutes', 
          EXTRACT(EPOCH FROM (start_time - v_service.service_time))/60,
        'duration_minutes', duration_minutes,
        'notes', notes
      ) ORDER BY display_order
    )
  )
  INTO v_segments
  FROM service_segments
  WHERE service_instance_id = p_service_instance_id;
  
  -- Create new template
  INSERT INTO service_templates (
    org_id,
    name,
    description,
    context_id,
    default_start_time,
    structure
  )
  VALUES (
    v_service.org_id,
    p_template_name,
    p_description,
    v_service.context_id,
    v_service.service_time,
    v_segments
  )
  RETURNING id INTO v_new_template_id;
  
  RETURN v_new_template_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION save_service_as_template IS 'Create a new template from an existing service';

-- ==========================================
-- VIEW: Template Summary
-- ==========================================
CREATE OR REPLACE VIEW v_template_summary AS
SELECT 
  t.id,
  t.name,
  t.description,
  c.name as context_name,
  t.default_start_time,
  t.default_duration_minutes,
  t.is_default,
  jsonb_array_length(t.structure->'segments') as segment_count,
  t.created_at,
  p.display_name as created_by_name
FROM service_templates t
LEFT JOIN contexts c ON c.id = t.context_id
LEFT JOIN people p ON p.id = t.created_by
WHERE t.is_active = true
ORDER BY c.name, t.is_default DESC, t.name;

COMMIT;

-- ==========================================
-- VERIFICATION
-- ==========================================
SELECT * FROM v_template_summary;

-- Example: Apply Standard Sunday template to Dec 28 service
/*
SELECT apply_template_to_service(
  (SELECT id FROM service_templates WHERE name = 'Standard Sunday'),
  (SELECT si.id FROM service_instances si 
   JOIN service_groups sg ON sg.id = si.service_group_id
   WHERE sg.group_date = '2025-12-28' AND si.service_time = '09:00:00'
   LIMIT 1)
);
*/
