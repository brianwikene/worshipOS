-- /db/archive/seed-ministry-areas.sql
-- ============================================================================
-- MINISTRY AREAS SEED DATA
-- 2024-12-30
--
-- Run this after 2024-12-30-service-schema-v2.sql migration
-- Seeds ministry areas for dev tenants
-- ============================================================================

-- ============================================================================
-- DEV TENANT: Bethany (Test)
-- ============================================================================

INSERT INTO ministry_areas (church_id, name, display_name, description, color, icon, display_order)
VALUES
  -- Worship Ministry (music, vocals, production)
  ('84c66cbb-1f13-4ed2-8416-076755b5dc49', 'worship', 'Worship Ministry',
   'Music, vocals, and worship production',
   '#8B5CF6', 'music', 1),

  -- Pastoral (preaching, prayer, communion)
  ('84c66cbb-1f13-4ed2-8416-076755b5dc49', 'pastoral', 'Pastoral',
   'Preaching, teaching, prayer, and pastoral care',
   '#3B82F6', 'book-open', 2),

  -- Kids Ministry
  ('84c66cbb-1f13-4ed2-8416-076755b5dc49', 'kids', 'Kids Ministry',
   'Children''s church, nursery, and kids programs',
   '#F59E0B', 'users', 3),

  -- Youth Ministry
  ('84c66cbb-1f13-4ed2-8416-076755b5dc49', 'youth', 'Youth Ministry',
   'Middle school and high school ministry',
   '#10B981', 'lightning-bolt', 4),

  -- Hospitality (greeters, ushers, communion servers)
  ('84c66cbb-1f13-4ed2-8416-076755b5dc49', 'hospitality', 'Hospitality',
   'Greeters, ushers, welcome team, and communion servers',
   '#EC4899', 'heart', 5),

  -- Tech & Production (sound, lights, video, streaming)
  ('84c66cbb-1f13-4ed2-8416-076755b5dc49', 'tech', 'Tech & Production',
   'Sound, lighting, video, slides, and live streaming',
   '#6366F1', 'desktop-computer', 6),

  -- Administration
  ('84c66cbb-1f13-4ed2-8416-076755b5dc49', 'admin', 'Administration',
   'Church administration and operations',
   '#64748B', 'cog', 7)

ON CONFLICT (church_id, name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;


-- ============================================================================
-- DEV TENANT: Vineyard (Test)
-- ============================================================================

INSERT INTO ministry_areas (church_id, name, display_name, description, color, icon, display_order)
VALUES
  ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'worship', 'Worship Ministry',
   'Music, vocals, and worship production',
   '#8B5CF6', 'music', 1),

  ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'pastoral', 'Pastoral',
   'Preaching, teaching, prayer, and pastoral care',
   '#3B82F6', 'book-open', 2),

  ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'kids', 'Kids Ministry',
   'Children''s church, nursery, and kids programs',
   '#F59E0B', 'users', 3),

  ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'youth', 'Youth Ministry',
   'Middle school and high school ministry',
   '#10B981', 'lightning-bolt', 4),

  ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'hospitality', 'Hospitality',
   'Greeters, ushers, welcome team, and communion servers',
   '#EC4899', 'heart', 5),

  ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'tech', 'Tech & Production',
   'Sound, lighting, video, slides, and live streaming',
   '#6366F1', 'desktop-computer', 6),

  ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'admin', 'Administration',
   'Church administration and operations',
   '#64748B', 'cog', 7)

ON CONFLICT (church_id, name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;


-- ============================================================================
-- SUB-MINISTRY AREAS (Optional Hierarchy)
-- Examples of how to create sub-areas under a parent
-- ============================================================================

-- Tech sub-areas for Bethany
INSERT INTO ministry_areas (church_id, name, display_name, description, color, icon, display_order, parent_id)
SELECT
  '84c66cbb-1f13-4ed2-8416-076755b5dc49',
  sub.name,
  sub.display_name,
  sub.description,
  sub.color,
  sub.icon,
  sub.display_order,
  parent.id
FROM (
  VALUES
    ('sound', 'Sound', 'Audio mixing and monitor management', '#818CF8', 'volume-up', 1),
    ('lighting', 'Lighting', 'Stage and house lighting', '#818CF8', 'light-bulb', 2),
    ('video', 'Video', 'Cameras, switching, and IMAG', '#818CF8', 'video-camera', 3),
    ('slides', 'Slides/Lyrics', 'Presentation and lyrics display', '#818CF8', 'presentation-chart-bar', 4),
    ('streaming', 'Live Streaming', 'Online broadcast and recording', '#818CF8', 'globe', 5)
) AS sub(name, display_name, description, color, icon, display_order)
CROSS JOIN (
  SELECT id FROM ministry_areas
  WHERE church_id = '84c66cbb-1f13-4ed2-8416-076755b5dc49' AND name = 'tech'
) AS parent
ON CONFLICT (church_id, name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id;


-- Worship sub-areas for Bethany
INSERT INTO ministry_areas (church_id, name, display_name, description, color, icon, display_order, parent_id)
SELECT
  '84c66cbb-1f13-4ed2-8416-076755b5dc49',
  sub.name,
  sub.display_name,
  sub.description,
  sub.color,
  sub.icon,
  sub.display_order,
  parent.id
FROM (
  VALUES
    ('vocals', 'Vocals', 'Worship vocals and backing vocals', '#A78BFA', 'microphone', 1),
    ('band', 'Band', 'Instrumental musicians', '#A78BFA', 'music-note', 2),
    ('production', 'Worship Production', 'Worship flow and transitions', '#A78BFA', 'clipboard-list', 3)
) AS sub(name, display_name, description, color, icon, display_order)
CROSS JOIN (
  SELECT id FROM ministry_areas
  WHERE church_id = '84c66cbb-1f13-4ed2-8416-076755b5dc49' AND name = 'worship'
) AS parent
ON CONFLICT (church_id, name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id;


-- ============================================================================
-- SAMPLE SERVICE TYPES
-- ============================================================================

-- Sunday AM for Bethany
INSERT INTO service_types (
  church_id,
  name,
  description,
  recurrence_rule,
  default_times,
  planning_lead_days
)
VALUES (
  '84c66cbb-1f13-4ed2-8416-076755b5dc49',
  'Sunday AM',
  'Regular Sunday morning worship services',
  '{"frequency": "weekly", "day_of_week": ["sunday"]}',
  '[
    {"time": "09:00", "label": "Early Service"},
    {"time": "11:00", "label": "Late Service"}
  ]'::jsonb,
  14
)
ON CONFLICT (church_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  recurrence_rule = EXCLUDED.recurrence_rule,
  default_times = EXCLUDED.default_times;


-- Wednesday Night for Bethany
INSERT INTO service_types (
  church_id,
  name,
  description,
  recurrence_rule,
  default_times,
  planning_lead_days
)
VALUES (
  '84c66cbb-1f13-4ed2-8416-076755b5dc49',
  'Wednesday Night',
  'Midweek service and prayer',
  '{"frequency": "weekly", "day_of_week": ["wednesday"]}',
  '[{"time": "19:00", "label": "Evening Service"}]'::jsonb,
  7
)
ON CONFLICT (church_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  recurrence_rule = EXCLUDED.recurrence_rule,
  default_times = EXCLUDED.default_times;


-- ============================================================================
-- SAMPLE TEMPLATE SECTIONS
-- Shows how to link sections to ministry areas
-- ============================================================================

-- First, ensure we have a basic template
INSERT INTO service_templates (
  church_id,
  name,
  description,
  default_start_time,
  default_duration_minutes,
  is_default
)
VALUES (
  '84c66cbb-1f13-4ed2-8416-076755b5dc49',
  'Standard Sunday',
  'Default Sunday morning service format',
  '09:00',
  90,
  true
)
ON CONFLICT (church_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  is_default = EXCLUDED.is_default
RETURNING id;

-- Add template sections (run after template exists)
DO $$
DECLARE
  v_template_id UUID;
  v_church_id UUID := '84c66cbb-1f13-4ed2-8416-076755b5dc49';
  v_worship_id UUID;
  v_pastoral_id UUID;
  v_hospitality_id UUID;
  v_tech_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get template ID
  SELECT id INTO v_template_id
  FROM service_templates
  WHERE church_id = v_church_id AND name = 'Standard Sunday';

  -- Get ministry area IDs
  SELECT id INTO v_worship_id FROM ministry_areas WHERE church_id = v_church_id AND name = 'worship';
  SELECT id INTO v_pastoral_id FROM ministry_areas WHERE church_id = v_church_id AND name = 'pastoral';
  SELECT id INTO v_hospitality_id FROM ministry_areas WHERE church_id = v_church_id AND name = 'hospitality';
  SELECT id INTO v_tech_id FROM ministry_areas WHERE church_id = v_church_id AND name = 'tech';
  SELECT id INTO v_admin_id FROM ministry_areas WHERE church_id = v_church_id AND name = 'admin';

  IF v_template_id IS NOT NULL THEN
    -- Insert template sections
    INSERT INTO template_sections (
      church_id, template_id, display_order, name, section_type,
      relative_start_minutes, estimated_duration_minutes, ministry_area_id,
      is_required, config
    )
    VALUES
      -- Pre-service
      (v_church_id, v_template_id, 1, 'Pre-Service', 'transition',
       -15, 15, v_tech_id, false,
       '{"notes": "Countdown, announcements loop"}'::jsonb),

      -- Welcome
      (v_church_id, v_template_id, 2, 'Welcome & Greeting', 'announcement',
       0, 5, v_hospitality_id, true,
       '{"max_items": 3}'::jsonb),

      -- Opening Worship
      (v_church_id, v_template_id, 3, 'Opening Worship', 'worship',
       5, 20, v_worship_id, true,
       '{"min_songs": 2, "max_songs": 4}'::jsonb),

      -- Announcements
      (v_church_id, v_template_id, 4, 'Announcements', 'announcement',
       25, 5, v_admin_id, false,
       '{"max_items": 5}'::jsonb),

      -- Offering
      (v_church_id, v_template_id, 5, 'Offering', 'offering',
       30, 5, v_hospitality_id, true,
       '{}'::jsonb),

      -- Message
      (v_church_id, v_template_id, 6, 'Message', 'message',
       35, 35, v_pastoral_id, true,
       '{"requires_title": true, "requires_scripture": true}'::jsonb),

      -- Response/Altar
      (v_church_id, v_template_id, 7, 'Response', 'worship',
       70, 10, v_worship_id, false,
       '{"min_songs": 1, "max_songs": 2}'::jsonb),

      -- Closing
      (v_church_id, v_template_id, 8, 'Closing & Benediction', 'prayer',
       80, 5, v_pastoral_id, true,
       '{}'::jsonb),

      -- Postlude
      (v_church_id, v_template_id, 9, 'Postlude', 'transition',
       85, 5, v_tech_id, false,
       '{"notes": "Exit music"}'::jsonb)

    ON CONFLICT (template_id, display_order) DO UPDATE SET
      name = EXCLUDED.name,
      section_type = EXCLUDED.section_type,
      ministry_area_id = EXCLUDED.ministry_area_id,
      estimated_duration_minutes = EXCLUDED.estimated_duration_minutes;
  END IF;
END $$;


-- ============================================================================
-- VERIFICATION QUERY
-- Run this to verify seed data was inserted correctly
-- ============================================================================

-- SELECT
--   ma.name,
--   ma.display_name,
--   ma.color,
--   pma.name AS parent_name,
--   ma.display_order
-- FROM ministry_areas ma
-- LEFT JOIN ministry_areas pma ON pma.id = ma.parent_id
-- WHERE ma.church_id = '84c66cbb-1f13-4ed2-8416-076755b5dc49'
-- ORDER BY COALESCE(pma.display_order, ma.display_order), ma.display_order;
