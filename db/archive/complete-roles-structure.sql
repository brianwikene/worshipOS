-- /db/archive/complete-roles-structure.sql
-- =====================================================
-- COMPLETE ROLES STRUCTURE FOR MOUNTAIN VINEYARD
-- All ministry areas and positions
-- =====================================================

DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_sunday_am_id uuid;
  
  -- Worship roles
  v_worship_leader_id uuid;
  v_acoustic_guitar_id uuid;
  v_electric_guitar_id uuid;
  v_bass_id uuid;
  v_drums_id uuid;
  v_piano_id uuid;
  v_keys_id uuid;
  v_percussion_id uuid;
  v_bgv_id uuid;
  
  -- Tech roles
  v_foh_audio_id uuid;
  v_livestream_audio_id uuid;
  v_lyrics_id uuid;
  v_video_producer_id uuid;
  
  -- Prayer Team
  v_prayer_team_id uuid;
  
  -- Hospitality
  v_greeter_id uuid;
  v_hospitality_id uuid;
  
  -- Kids Ministry
  v_nursery_id uuid;
  v_toddlers_id uuid;
  v_basecamp_id uuid;
  v_kids_checkin_id uuid;
  
  -- Youth
  v_youth_leader_id uuid;
  
BEGIN
  -- Get Sunday AM context
  SELECT id INTO v_sunday_am_id FROM contexts WHERE org_id = v_org_id AND name = 'Sunday AM';
  
  -- First, delete the old incomplete roles and requirements to start fresh
  DELETE FROM service_role_requirements WHERE org_id = v_org_id;
  DELETE FROM service_assignments WHERE org_id = v_org_id;
  DELETE FROM roles WHERE org_id = v_org_id;
  
  -- ==========================================
  -- WORSHIP TEAM
  -- ==========================================
  INSERT INTO roles (org_id, name, ministry_area, description)
  VALUES 
    (v_org_id, 'Worship Leader', 'Worship', 'Leads congregational worship (may or may not play instrument)'),
    (v_org_id, 'Acoustic Guitar', 'Worship', 'Acoustic guitar player'),
    (v_org_id, 'Electric Guitar', 'Worship', 'Electric guitar player'),
    (v_org_id, 'Bass Guitar', 'Worship', 'Bass guitar player'),
    (v_org_id, 'Drums', 'Worship', 'Drummer'),
    (v_org_id, 'Piano', 'Worship', 'Piano/Keys player'),
    (v_org_id, 'Keys/Synth', 'Worship', 'Keyboard/Synthesizer'),
    (v_org_id, 'Percussion', 'Worship', 'Percussion instruments (cajón, shaker, etc.)'),
    (v_org_id, 'Background Vocals', 'Worship', 'Backup singer/vocalist')
  ON CONFLICT DO NOTHING;
  
  -- Get worship role IDs
  SELECT id INTO v_worship_leader_id FROM roles WHERE org_id = v_org_id AND name = 'Worship Leader';
  SELECT id INTO v_acoustic_guitar_id FROM roles WHERE org_id = v_org_id AND name = 'Acoustic Guitar';
  SELECT id INTO v_electric_guitar_id FROM roles WHERE org_id = v_org_id AND name = 'Electric Guitar';
  SELECT id INTO v_bass_id FROM roles WHERE org_id = v_org_id AND name = 'Bass Guitar';
  SELECT id INTO v_drums_id FROM roles WHERE org_id = v_org_id AND name = 'Drums';
  SELECT id INTO v_piano_id FROM roles WHERE org_id = v_org_id AND name = 'Piano';
  SELECT id INTO v_keys_id FROM roles WHERE org_id = v_org_id AND name = 'Keys/Synth';
  SELECT id INTO v_percussion_id FROM roles WHERE org_id = v_org_id AND name = 'Percussion';
  SELECT id INTO v_bgv_id FROM roles WHERE org_id = v_org_id AND name = 'Background Vocals';
  
  -- ==========================================
  -- TECH TEAM
  -- ==========================================
  INSERT INTO roles (org_id, name, ministry_area, description)
  VALUES 
    (v_org_id, 'FOH Audio', 'Tech', 'Front of House audio engineer'),
    (v_org_id, 'Livestream Audio', 'Tech', 'Livestream audio mix engineer'),
    (v_org_id, 'Lyrics (ProPresenter)', 'Tech', 'Lyrics and slides operator'),
    (v_org_id, 'Video Producer', 'Tech', 'Remote camera control and livestream production')
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_foh_audio_id FROM roles WHERE org_id = v_org_id AND name = 'FOH Audio';
  SELECT id INTO v_livestream_audio_id FROM roles WHERE org_id = v_org_id AND name = 'Livestream Audio';
  SELECT id INTO v_lyrics_id FROM roles WHERE org_id = v_org_id AND name = 'Lyrics (ProPresenter)';
  SELECT id INTO v_video_producer_id FROM roles WHERE org_id = v_org_id AND name = 'Video Producer';
  
  -- ==========================================
  -- PRAYER TEAM
  -- ==========================================
  INSERT INTO roles (org_id, name, ministry_area, description)
  VALUES 
    (v_org_id, 'Prayer Team', 'Prayer', 'Available for prayer ministry during/after service')
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_prayer_team_id FROM roles WHERE org_id = v_org_id AND name = 'Prayer Team';
  
  -- ==========================================
  -- HOSPITALITY & GREETING
  -- ==========================================
  INSERT INTO roles (org_id, name, ministry_area, description)
  VALUES 
    (v_org_id, 'Greeter', 'Hospitality', 'Welcome people at doors'),
    (v_org_id, 'Hospitality', 'Hospitality', 'Coffee, snacks, general hospitality')
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_greeter_id FROM roles WHERE org_id = v_org_id AND name = 'Greeter';
  SELECT id INTO v_hospitality_id FROM roles WHERE org_id = v_org_id AND name = 'Hospitality';
  
  -- ==========================================
  -- KIDS MINISTRY
  -- ==========================================
  INSERT INTO roles (org_id, name, ministry_area, description)
  VALUES 
    (v_org_id, 'Nursery', 'Kids Ministry', 'Nursery worker (infants)'),
    (v_org_id, 'Toddlers', 'Kids Ministry', 'Toddlers classroom worker'),
    (v_org_id, 'BaseCamp', 'Kids Ministry', 'BaseCamp (elementary) leader/helper'),
    (v_org_id, 'Kids Check-in', 'Kids Ministry', 'Check-in/check-out overseer')
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_nursery_id FROM roles WHERE org_id = v_org_id AND name = 'Nursery';
  SELECT id INTO v_toddlers_id FROM roles WHERE org_id = v_org_id AND name = 'Toddlers';
  SELECT id INTO v_basecamp_id FROM roles WHERE org_id = v_org_id AND name = 'BaseCamp';
  SELECT id INTO v_kids_checkin_id FROM roles WHERE org_id = v_org_id AND name = 'Kids Check-in';
  
  -- ==========================================
  -- YOUTH MINISTRY
  -- ==========================================
  INSERT INTO roles (org_id, name, ministry_area, description)
  VALUES 
    (v_org_id, 'Youth Leader', 'Youth', 'Youth group leader')
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_youth_leader_id FROM roles WHERE org_id = v_org_id AND name = 'Youth Leader';
  
  -- ==========================================
  -- SUNDAY AM SERVICE REQUIREMENTS
  -- ==========================================
  INSERT INTO service_role_requirements (org_id, context_id, role_id, min_needed, max_needed, is_required, display_order)
  VALUES
    -- WORSHIP (display_order 1-19)
    (v_org_id, v_sunday_am_id, v_worship_leader_id, 1, 2, true, 1),  -- 1-2 leaders (can co-lead)
    (v_org_id, v_sunday_am_id, v_bgv_id, 1, 2, true, 2),            -- 1-2 BGV
    (v_org_id, v_sunday_am_id, v_drums_id, 1, 1, true, 10),          -- Always need drums
    (v_org_id, v_sunday_am_id, v_bass_id, 1, 1, true, 11),           -- Always need bass
    (v_org_id, v_sunday_am_id, v_acoustic_guitar_id, 0, 2, false, 12), -- 0-2 acoustic
    (v_org_id, v_sunday_am_id, v_electric_guitar_id, 0, 2, false, 13), -- 0-2 electric
    (v_org_id, v_sunday_am_id, v_piano_id, 0, 1, false, 14),         -- 0-1 piano
    (v_org_id, v_sunday_am_id, v_keys_id, 0, 1, false, 15),          -- 0-1 keys
    (v_org_id, v_sunday_am_id, v_percussion_id, 0, 1, false, 16),    -- 0-1 percussion
    
    -- TECH (display_order 20-29)
    (v_org_id, v_sunday_am_id, v_foh_audio_id, 1, 1, true, 20),
    (v_org_id, v_sunday_am_id, v_livestream_audio_id, 1, 1, true, 21),
    (v_org_id, v_sunday_am_id, v_lyrics_id, 1, 1, true, 22),
    (v_org_id, v_sunday_am_id, v_video_producer_id, 1, 1, true, 23),
    
    -- PRAYER TEAM (display_order 30-34)
    (v_org_id, v_sunday_am_id, v_prayer_team_id, 3, 5, true, 30),    -- 3-5 prayer team members
    
    -- HOSPITALITY (display_order 35-39)
    (v_org_id, v_sunday_am_id, v_greeter_id, 4, 4, true, 35),        -- 4 greeters (2 at each door)
    (v_org_id, v_sunday_am_id, v_hospitality_id, 1, 2, true, 36),    -- 1-2 hospitality
    
    -- KIDS MINISTRY (display_order 40-49)
    (v_org_id, v_sunday_am_id, v_nursery_id, 2, 2, true, 40),        -- 2 nursery
    (v_org_id, v_sunday_am_id, v_toddlers_id, 2, 2, true, 41),       -- 2 toddlers
    (v_org_id, v_sunday_am_id, v_basecamp_id, 2, 2, true, 42),       -- 2 BaseCamp
    (v_org_id, v_sunday_am_id, v_kids_checkin_id, 1, 1, true, 43),   -- 1 check-in overseer
    
    -- YOUTH (display_order 50-54)
    (v_org_id, v_sunday_am_id, v_youth_leader_id, 1, 1, true, 50);   -- 1 youth leader
  
  RAISE NOTICE '✓ Created % roles across all ministry areas', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id);
  RAISE NOTICE '✓ Created % position requirements for Sunday AM', (SELECT COUNT(*) FROM service_role_requirements WHERE context_id = v_sunday_am_id);
  
  -- Show breakdown by ministry area
  RAISE NOTICE '  - Worship: %', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id AND ministry_area = 'Worship');
  RAISE NOTICE '  - Tech: %', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id AND ministry_area = 'Tech');
  RAISE NOTICE '  - Prayer: %', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id AND ministry_area = 'Prayer');
  RAISE NOTICE '  - Hospitality: %', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id AND ministry_area = 'Hospitality');
  RAISE NOTICE '  - Kids Ministry: %', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id AND ministry_area = 'Kids Ministry');
  RAISE NOTICE '  - Youth: %', (SELECT COUNT(*) FROM roles WHERE org_id = v_org_id AND ministry_area = 'Youth');
  
END $$;

-- ==========================================
-- SAMPLE ASSIGNMENTS: Dec 21, 2025
-- ==========================================
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_dec21_9am_id uuid;
  v_dec21_11am_id uuid;
  
  -- People
  v_brian_id uuid;
  v_jimmy_john_id uuid;
  v_jeff_id uuid;
  v_michelle_id uuid;
  v_shelby_id uuid;
  v_donna_id uuid;
  
  -- Roles
  v_worship_leader_id uuid;
  v_piano_id uuid;
  v_acoustic_id uuid;
  v_electric_id uuid;
  v_bgv_id uuid;
  v_drums_id uuid;
  v_bass_id uuid;
  v_prayer_id uuid;
  v_greeter_id uuid;
  
BEGIN
  -- Get service instances for Dec 21
  SELECT si.id INTO v_dec21_9am_id
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE sg.group_date = '2025-12-21' AND si.service_time = '09:00:00'
  LIMIT 1;
  
  SELECT si.id INTO v_dec21_11am_id
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE sg.group_date = '2025-12-21' AND si.service_time = '11:00:00'
  LIMIT 1;
  
  -- Get/create people
  SELECT id INTO v_brian_id FROM people WHERE org_id = v_org_id AND display_name = 'Brian Wikene';
  
  INSERT INTO people (org_id, display_name)
  VALUES 
    (v_org_id, 'Jimmy John'),
    (v_org_id, 'Jeff'),
    (v_org_id, 'Michelle'),
    (v_org_id, 'Shelby'),
    (v_org_id, 'Donna')
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_jimmy_john_id FROM people WHERE org_id = v_org_id AND display_name = 'Jimmy John';
  SELECT id INTO v_jeff_id FROM people WHERE org_id = v_org_id AND display_name = 'Jeff';
  SELECT id INTO v_michelle_id FROM people WHERE org_id = v_org_id AND display_name = 'Michelle';
  SELECT id INTO v_shelby_id FROM people WHERE org_id = v_org_id AND display_name = 'Shelby';
  SELECT id INTO v_donna_id FROM people WHERE org_id = v_org_id AND display_name = 'Donna';
  
  -- Get roles
  SELECT id INTO v_worship_leader_id FROM roles WHERE org_id = v_org_id AND name = 'Worship Leader';
  SELECT id INTO v_piano_id FROM roles WHERE org_id = v_org_id AND name = 'Piano';
  SELECT id INTO v_acoustic_id FROM roles WHERE org_id = v_org_id AND name = 'Acoustic Guitar';
  SELECT id INTO v_electric_id FROM roles WHERE org_id = v_org_id AND name = 'Electric Guitar';
  SELECT id INTO v_bgv_id FROM roles WHERE org_id = v_org_id AND name = 'Background Vocals';
  SELECT id INTO v_drums_id FROM roles WHERE org_id = v_org_id AND name = 'Drums';
  SELECT id INTO v_bass_id FROM roles WHERE org_id = v_org_id AND name = 'Bass Guitar';
  SELECT id INTO v_prayer_id FROM roles WHERE org_id = v_org_id AND name = 'Prayer Team';
  SELECT id INTO v_greeter_id FROM roles WHERE org_id = v_org_id AND name = 'Greeter';
  
  -- 9 AM Service: Brian (piano/lead) + Jimmy John (acoustic/co-lead) + Michelle (BGV)
  INSERT INTO service_assignments (org_id, service_instance_id, role_id, person_id, status, is_lead, notes)
  VALUES
    (v_org_id, v_dec21_9am_id, v_worship_leader_id, v_brian_id, 'confirmed', true, 'Leading from piano'),
    (v_org_id, v_dec21_9am_id, v_piano_id, v_brian_id, 'confirmed', false, NULL),
    (v_org_id, v_dec21_9am_id, v_worship_leader_id, v_jimmy_john_id, 'confirmed', true, 'Co-leading'),
    (v_org_id, v_dec21_9am_id, v_acoustic_id, v_jimmy_john_id, 'confirmed', false, NULL),
    (v_org_id, v_dec21_9am_id, v_bgv_id, v_michelle_id, 'confirmed', false, NULL),
    -- Unfilled positions (NULL person_id)
    (v_org_id, v_dec21_9am_id, v_drums_id, NULL, 'pending', false, 'Need drummer'),
    (v_org_id, v_dec21_9am_id, v_bass_id, NULL, 'pending', false, 'Need bass player'),
    (v_org_id, v_dec21_9am_id, v_greeter_id, NULL, 'pending', false, 'Need 4 greeters'),
    (v_org_id, v_dec21_9am_id, v_prayer_id, NULL, 'pending', false, 'Need 3-5 prayer team');
  
  -- 11 AM Service: Shelby (lead, no instrument) + Jeff (electric) + Donna (BGV)
  INSERT INTO service_assignments (org_id, service_instance_id, role_id, person_id, status, is_lead, notes)
  VALUES
    (v_org_id, v_dec21_11am_id, v_worship_leader_id, v_shelby_id, 'confirmed', true, 'Vocal leader'),
    (v_org_id, v_dec21_11am_id, v_electric_id, v_jeff_id, 'pending', false, 'Awaiting confirmation'),
    (v_org_id, v_dec21_11am_id, v_bgv_id, v_donna_id, 'confirmed', false, NULL),
    (v_org_id, v_dec21_11am_id, v_bass_id, NULL, 'pending', false, 'Need to fill'),
    (v_org_id, v_dec21_11am_id, v_drums_id, NULL, 'pending', false, 'Need to fill');
  
  RAISE NOTICE '✓ Created sample assignments for Dec 21 services';
END $$;

COMMIT;

-- Show what we created
SELECT 
  ministry_area,
  COUNT(*) as role_count,
  string_agg(name, ', ' ORDER BY name) as roles
FROM roles 
WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
GROUP BY ministry_area
ORDER BY ministry_area;
