-- /db/archive/seed-data-v3.sql
-- =====================================================
-- WorshipOS Comprehensive Seed Data (V3 - CORRECTED)
-- Let PostgreSQL generate UUIDs automatically
-- =====================================================

-- ──────────────────────────────────────────────────
-- CAMPUSES
-- ──────────────────────────────────────────────────

INSERT INTO campuses (org_id, name, location, address, is_active) VALUES
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Main Campus', 'Auburn, WA', '123 Church Street, Auburn, WA 98001', true),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'North Campus', 'Federal Way, WA', '456 Worship Lane, Federal Way, WA 98003', true),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'South Campus', 'Tacoma, WA', '789 Faith Avenue, Tacoma, WA 98401', true)
ON CONFLICT (org_id, name) DO NOTHING;


-- ──────────────────────────────────────────────────
-- CONTEXTS (Service Types)
-- ──────────────────────────────────────────────────

INSERT INTO contexts (org_id, name, description, is_active) VALUES
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Wednesday Night', 'Midweek prayer and worship service', true),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Youth Service', 'Friday night youth gathering', true),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Special Events', 'Easter, Christmas, Good Friday, etc.', true)
ON CONFLICT (org_id, name) DO NOTHING;


-- ──────────────────────────────────────────────────
-- ROLES (Ministry Positions)
-- ──────────────────────────────────────────────────

INSERT INTO roles (org_id, name, load_weight) VALUES
    -- Worship Team
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Worship Leader', 25),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Vocalist', 10),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Keys/Piano', 15),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Guitar', 15),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Bass', 15),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Drums', 15),
    
    -- Production Team
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sound Tech', 20),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Lighting Tech', 15),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Video/ProPresenter', 15),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Livestream Tech', 20),
    
    -- Hospitality Team
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Greeter', 5),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Usher', 5),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Coffee/Hospitality', 10),
    
    -- Kids/Youth
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Kids Ministry Leader', 20),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Kids Ministry Helper', 10),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Youth Leader', 20),
    
    -- Other
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Prayer Team', 8),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Parking Team', 5)
ON CONFLICT (org_id, name) DO NOTHING;


-- ──────────────────────────────────────────────────
-- PEOPLE (Volunteers and Staff)
-- ──────────────────────────────────────────────────

INSERT INTO people (org_id, display_name) VALUES
    -- Leadership/Staff
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Brian Wikene'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Heather Wikene'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Mike Thompson'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'David Rummelhart'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'David "Dash" Ritchie'),
    
    -- Worship Team
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sarah Johnson'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Marcus Chen'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Emily Rodriguez'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'James Wilson'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Tyler Anderson'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Alex Martinez'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Rachel Lee'),
    
    -- Production Team
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Chris Thompson'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Jordan Kim'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sam Patel'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Morgan Davis'),
    
    -- Hospitality
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Lisa Brown'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Tom Garcia'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Maria Santos'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'John Miller'),
    
    -- Kids/Youth
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Amy White'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Kevin Taylor'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Jessica Moore'),
    
    -- Other volunteers
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Daniel Clark'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sophia Lewis')
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────
-- PERSON ROLE CAPABILITIES
-- ──────────────────────────────────────────────────

DO $$
DECLARE
    brian_id UUID;
    sarah_id UUID;
    marcus_id UUID;
    rachel_id UUID;
    emily_id UUID;
    james_id UUID;
    tyler_id UUID;
    alex_id UUID;
    chris_id UUID;
    jordan_id UUID;
    sam_id UUID;
    morgan_id UUID;
    lisa_id UUID;
    john_id UUID;
    tom_id UUID;
    maria_id UUID;
    amy_id UUID;
    kevin_id UUID;
    jessica_id UUID;
    daniel_id UUID;
    sophia_id UUID;
    
    worship_leader_role UUID;
    vocalist_role UUID;
    keys_role UUID;
    guitar_role UUID;
    bass_role UUID;
    drums_role UUID;
    sound_role UUID;
    lights_role UUID;
    video_role UUID;
    stream_role UUID;
    greeter_role UUID;
    usher_role UUID;
    coffee_role UUID;
    kids_leader_role UUID;
    kids_helper_role UUID;
    youth_leader_role UUID;
    prayer_role UUID;
    parking_role UUID;
BEGIN
    -- Get people IDs
    SELECT id INTO brian_id FROM people WHERE display_name = 'Brian Wikene';
    SELECT id INTO sarah_id FROM people WHERE display_name = 'Sarah Johnson';
    SELECT id INTO marcus_id FROM people WHERE display_name = 'Marcus Chen';
    SELECT id INTO rachel_id FROM people WHERE display_name = 'Rachel Lee';
    SELECT id INTO emily_id FROM people WHERE display_name = 'Emily Rodriguez';
    SELECT id INTO james_id FROM people WHERE display_name = 'James Wilson';
    SELECT id INTO tyler_id FROM people WHERE display_name = 'Tyler Anderson';
    SELECT id INTO alex_id FROM people WHERE display_name = 'Alex Martinez';
    SELECT id INTO chris_id FROM people WHERE display_name = 'Chris Thompson';
    SELECT id INTO jordan_id FROM people WHERE display_name = 'Jordan Kim';
    SELECT id INTO sam_id FROM people WHERE display_name = 'Sam Patel';
    SELECT id INTO morgan_id FROM people WHERE display_name = 'Morgan Davis';
    SELECT id INTO lisa_id FROM people WHERE display_name = 'Lisa Brown';
    SELECT id INTO john_id FROM people WHERE display_name = 'John Miller';
    SELECT id INTO tom_id FROM people WHERE display_name = 'Tom Garcia';
    SELECT id INTO maria_id FROM people WHERE display_name = 'Maria Santos';
    SELECT id INTO amy_id FROM people WHERE display_name = 'Amy White';
    SELECT id INTO kevin_id FROM people WHERE display_name = 'Kevin Taylor';
    SELECT id INTO jessica_id FROM people WHERE display_name = 'Jessica Moore';
    SELECT id INTO daniel_id FROM people WHERE display_name = 'Daniel Clark';
    SELECT id INTO sophia_id FROM people WHERE display_name = 'Sophia Lewis';
    
    -- Get role IDs
    SELECT id INTO worship_leader_role FROM roles WHERE name = 'Worship Leader';
    SELECT id INTO vocalist_role FROM roles WHERE name = 'Vocalist';
    SELECT id INTO keys_role FROM roles WHERE name = 'Keys/Piano';
    SELECT id INTO guitar_role FROM roles WHERE name = 'Guitar';
    SELECT id INTO bass_role FROM roles WHERE name = 'Bass';
    SELECT id INTO drums_role FROM roles WHERE name = 'Drums';
    SELECT id INTO sound_role FROM roles WHERE name = 'Sound Tech';
    SELECT id INTO lights_role FROM roles WHERE name = 'Lighting Tech';
    SELECT id INTO video_role FROM roles WHERE name = 'Video/ProPresenter';
    SELECT id INTO stream_role FROM roles WHERE name = 'Livestream Tech';
    SELECT id INTO greeter_role FROM roles WHERE name = 'Greeter';
    SELECT id INTO usher_role FROM roles WHERE name = 'Usher';
    SELECT id INTO coffee_role FROM roles WHERE name = 'Coffee/Hospitality';
    SELECT id INTO kids_leader_role FROM roles WHERE name = 'Kids Ministry Leader';
    SELECT id INTO kids_helper_role FROM roles WHERE name = 'Kids Ministry Helper';
    SELECT id INTO youth_leader_role FROM roles WHERE name = 'Youth Leader';
    SELECT id INTO prayer_role FROM roles WHERE name = 'Prayer Team';
    SELECT id INTO parking_role FROM roles WHERE name = 'Parking Team';
    
    -- Insert capabilities
    INSERT INTO person_role_capabilities (org_id, person_id, role_id, proficiency, is_primary, is_approved) VALUES
        -- Brian
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, brian_id, worship_leader_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, brian_id, vocalist_role, 4, false, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, brian_id, guitar_role, 3, false, true),
        
        -- Sarah
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sarah_id, vocalist_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sarah_id, worship_leader_role, 3, false, true),
        
        -- Marcus
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, marcus_id, vocalist_role, 4, true, true),
        
        -- Rachel
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, rachel_id, vocalist_role, 4, true, true),
        
        -- Emily
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, emily_id, keys_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, emily_id, worship_leader_role, 4, false, true),
        
        -- James
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, james_id, guitar_role, 5, true, true),
        
        -- Tyler
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, tyler_id, bass_role, 4, true, true),
        
        -- Alex
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, alex_id, drums_role, 5, true, true),
        
        -- Chris
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, chris_id, sound_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, chris_id, video_role, 3, false, true),
        
        -- Jordan
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, jordan_id, lights_role, 4, true, true),
        
        -- Sam
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sam_id, video_role, 5, true, true),
        
        -- Morgan
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, morgan_id, stream_role, 4, true, true),
        
        -- Hospitality
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, lisa_id, greeter_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, john_id, greeter_role, 4, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, tom_id, usher_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, maria_id, coffee_role, 5, true, true),
        
        -- Kids/Youth
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, amy_id, kids_leader_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, kevin_id, kids_helper_role, 4, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, jessica_id, youth_leader_role, 5, true, true),
        
        -- Other
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, daniel_id, prayer_role, 5, true, true),
        ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sophia_id, parking_role, 4, true, true)
    ON CONFLICT (person_id, role_id) DO NOTHING;
END $$;


-- ──────────────────────────────────────────────────
-- SERVICE ROLE REQUIREMENTS
-- ──────────────────────────────────────────────────

DO $$
DECLARE
    sunday_am_context_id UUID;
    wednesday_context_id UUID;
    youth_context_id UUID;
    
    worship_leader_role UUID;
    vocalist_role UUID;
    keys_role UUID;
    guitar_role UUID;
    bass_role UUID;
    drums_role UUID;
    sound_role UUID;
    video_role UUID;
    stream_role UUID;
    greeter_role UUID;
    usher_role UUID;
    kids_leader_role UUID;
    kids_helper_role UUID;
    youth_leader_role UUID;
BEGIN
    -- Get context IDs
    SELECT id INTO sunday_am_context_id FROM contexts WHERE name = 'Sunday AM';
    SELECT id INTO wednesday_context_id FROM contexts WHERE name = 'Wednesday Night';
    SELECT id INTO youth_context_id FROM contexts WHERE name = 'Youth Service';
    
    -- Get role IDs
    SELECT id INTO worship_leader_role FROM roles WHERE name = 'Worship Leader';
    SELECT id INTO vocalist_role FROM roles WHERE name = 'Vocalist';
    SELECT id INTO keys_role FROM roles WHERE name = 'Keys/Piano';
    SELECT id INTO guitar_role FROM roles WHERE name = 'Guitar';
    SELECT id INTO bass_role FROM roles WHERE name = 'Bass';
    SELECT id INTO drums_role FROM roles WHERE name = 'Drums';
    SELECT id INTO sound_role FROM roles WHERE name = 'Sound Tech';
    SELECT id INTO video_role FROM roles WHERE name = 'Video/ProPresenter';
    SELECT id INTO stream_role FROM roles WHERE name = 'Livestream Tech';
    SELECT id INTO greeter_role FROM roles WHERE name = 'Greeter';
    SELECT id INTO usher_role FROM roles WHERE name = 'Usher';
    SELECT id INTO kids_leader_role FROM roles WHERE name = 'Kids Ministry Leader';
    SELECT id INTO kids_helper_role FROM roles WHERE name = 'Kids Ministry Helper';
    SELECT id INTO youth_leader_role FROM roles WHERE name = 'Youth Leader';
    
    -- Sunday AM requirements
    IF sunday_am_context_id IS NOT NULL THEN
        INSERT INTO service_role_requirements (org_id, context_id, role_id, min_needed, max_needed) VALUES
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, worship_leader_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, vocalist_role, 2, 4),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, keys_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, guitar_role, 1, 2),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, bass_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, drums_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, sound_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, video_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, stream_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, greeter_role, 2, 4),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, usher_role, 2, 3),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, kids_leader_role, 1, 2),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, kids_helper_role, 2, 4)
        ON CONFLICT (context_id, role_id) DO NOTHING;
    END IF;
    
    -- Wednesday requirements
    IF wednesday_context_id IS NOT NULL THEN
        INSERT INTO service_role_requirements (org_id, context_id, role_id, min_needed, max_needed) VALUES
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, worship_leader_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, vocalist_role, 1, 2),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, keys_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, guitar_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, sound_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, video_role, 1, 1)
        ON CONFLICT (context_id, role_id) DO NOTHING;
    END IF;
    
    -- Youth requirements
    IF youth_context_id IS NOT NULL THEN
        INSERT INTO service_role_requirements (org_id, context_id, role_id, min_needed, max_needed) VALUES
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, youth_context_id, youth_leader_role, 1, 2),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, youth_context_id, worship_leader_role, 1, 1),
            ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, youth_context_id, sound_role, 1, 1)
        ON CONFLICT (context_id, role_id) DO NOTHING;
    END IF;
END $$;


-- ──────────────────────────────────────────────────
-- ADDITIONAL SERVICE GROUPS & INSTANCES
-- ──────────────────────────────────────────────────

DO $$
DECLARE
    sunday_am_context_id UUID;
    special_context_id UUID;
    main_campus_id UUID;
BEGIN
    SELECT id INTO sunday_am_context_id FROM contexts WHERE name = 'Sunday AM';
    SELECT id INTO special_context_id FROM contexts WHERE name = 'Special Events';
    SELECT id INTO main_campus_id FROM campuses WHERE name = 'Main Campus';
    
    -- December 21
    WITH new_group AS (
        INSERT INTO service_groups (org_id, group_date, name, context_id)
        VALUES ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, '2025-12-21', 'Sunday AM', sunday_am_context_id)
        RETURNING id
    )
    INSERT INTO service_instances (org_id, service_group_id, service_date, service_time, campus_id)
    SELECT 
        'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid,
        new_group.id,
        '2025-12-21',
        time_slot,
        main_campus_id
    FROM new_group
    CROSS JOIN (VALUES ('09:00:00'::time), ('11:00:00'::time)) AS times(time_slot);
    
    -- December 25 (Christmas)
    WITH new_group AS (
        INSERT INTO service_groups (org_id, group_date, name, context_id)
        VALUES ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, '2025-12-25', 'Christmas Day', special_context_id)
        RETURNING id
    )
    INSERT INTO service_instances (org_id, service_group_id, service_date, service_time, campus_id)
    SELECT 
        'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid,
        new_group.id,
        '2025-12-25',
        '10:00:00'::time,
        main_campus_id
    FROM new_group;
    
    -- December 28
    WITH new_group AS (
        INSERT INTO service_groups (org_id, group_date, name, context_id)
        VALUES ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, '2025-12-28', 'Sunday AM', sunday_am_context_id)
        RETURNING id
    )
    INSERT INTO service_instances (org_id, service_group_id, service_date, service_time, campus_id)
    SELECT 
        'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid,
        new_group.id,
        '2025-12-28',
        time_slot,
        main_campus_id
    FROM new_group
    CROSS JOIN (VALUES ('09:00:00'::time), ('11:00:00'::time)) AS times(time_slot);
END $$;


-- ──────────────────────────────────────────────────
-- SONGS
-- ──────────────────────────────────────────────────

INSERT INTO songs (org_id, title, ccli_id) VALUES
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Adonai', NULL),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Same Rain', NULL),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'You''re My Defender', NULL),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Way Maker', '7115744'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Goodness of God', '7117726'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Oceans (Where Feet May Fail)', '6428767'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, '10,000 Reasons', '6016351'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Great Are You Lord', '6460220');


-- ──────────────────────────────────────────────────
-- VERIFICATION
-- ──────────────────────────────────────────────────

SELECT 'Campuses' as table_name, COUNT(*) as count FROM campuses WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'Contexts', COUNT(*) FROM contexts WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'Roles', COUNT(*) FROM roles WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'People', COUNT(*) FROM people WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'Capabilities', COUNT(*) FROM person_role_capabilities WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'Requirements', COUNT(*) FROM service_role_requirements WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'Service Groups', COUNT(*) FROM service_groups WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'Service Instances', COUNT(*) FROM service_instances WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
UNION ALL
SELECT 'Songs', COUNT(*) FROM songs WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
