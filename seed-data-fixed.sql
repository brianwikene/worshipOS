-- =====================================================
-- WorshipOS Comprehensive Seed Data (CORRECTED)
-- Fixed: All UUIDs now use proper PostgreSQL syntax
-- =====================================================

-- Note: Your org already exists with this ID
-- org_id: a8c2c7ab-836a-4ef1-a373-562e20babb76

-- ──────────────────────────────────────────────────
-- CAMPUSES
-- ──────────────────────────────────────────────────

INSERT INTO campuses (id, org_id, name, location, address, is_active) VALUES
    ('c1111111-1111-1111-1111-111111111111'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Main Campus', 'Auburn, WA', '123 Church Street, Auburn, WA 98001', true),
    ('c2222222-2222-2222-2222-222222222222'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'North Campus', 'Federal Way, WA', '456 Worship Lane, Federal Way, WA 98003', true),
    ('c3333333-3333-3333-3333-333333333333'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'South Campus', 'Tacoma, WA', '789 Faith Avenue, Tacoma, WA 98401', true)
ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────────
-- CONTEXTS (Service Types)
-- ──────────────────────────────────────────────────

INSERT INTO contexts (id, org_id, name, description, is_active) VALUES
    ('ctx00000-wed0-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Wednesday Night', 'Midweek prayer and worship service', true),
    ('ctx00000-youth-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Youth Service', 'Friday night youth gathering', true),
    ('ctx00000-special-0000-00000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Special Events', 'Easter, Christmas, Good Friday, etc.', true)
ON CONFLICT (org_id, name) DO NOTHING;


-- ──────────────────────────────────────────────────
-- ROLES (Ministry Positions)
-- ──────────────────────────────────────────────────

INSERT INTO roles (id, org_id, name, load_weight) VALUES
    -- Worship Team
    ('role0000-wldr-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Worship Leader', 25),
    ('role0000-vocl-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Vocalist', 10),
    ('role0000-keys-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Keys/Piano', 15),
    ('role0000-guit-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Guitar', 15),
    ('role0000-bass-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Bass', 15),
    ('role0000-drum-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Drums', 15),
    
    -- Production Team
    ('role0000-sond-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sound Tech', 20),
    ('role0000-lght-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Lighting Tech', 15),
    ('role0000-vido-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Video/ProPresenter', 15),
    ('role0000-strm-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Livestream Tech', 20),
    
    -- Hospitality Team
    ('role0000-gret-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Greeter', 5),
    ('role0000-ushr-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Usher', 5),
    ('role0000-coff-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Coffee/Hospitality', 10),
    
    -- Kids/Youth
    ('role0000-kidl-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Kids Ministry Leader', 20),
    ('role0000-kidh-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Kids Ministry Helper', 10),
    ('role0000-ythl-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Youth Leader', 20),
    
    -- Other
    ('role0000-pray-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Prayer Team', 8),
    ('role0000-park-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Parking Team', 5)
ON CONFLICT (org_id, name) DO NOTHING;


-- ──────────────────────────────────────────────────
-- PEOPLE (Volunteers and Staff)
-- ──────────────────────────────────────────────────

INSERT INTO people (id, org_id, display_name) VALUES
    -- Leadership/Staff
    ('p0000000-bria-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Brian Wikene'),
    ('p0000000-heat-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Heather Wikene'),
    ('p0000000-mike-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Mike Thompson'),
    ('p0000000-davr-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'David Rummelhart'),
    ('p0000000-davd-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'David "Dash" Ritchie'),
    
    -- Worship Team
    ('p0000000-sara-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sarah Johnson'),
    ('p0000000-marc-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Marcus Chen'),
    ('p0000000-emil-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Emily Rodriguez'),
    ('p0000000-jame-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'James Wilson'),
    ('p0000000-tyle-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Tyler Anderson'),
    ('p0000000-alex-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Alex Martinez'),
    ('p0000000-rach-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Rachel Lee'),
    
    -- Production Team
    ('p0000000-chri-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Chris Thompson'),
    ('p0000000-jord-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Jordan Kim'),
    ('p0000000-samp-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sam Patel'),
    ('p0000000-morg-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Morgan Davis'),
    
    -- Hospitality
    ('p0000000-lisa-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Lisa Brown'),
    ('p0000000-tomg-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Tom Garcia'),
    ('p0000000-mari-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Maria Santos'),
    ('p0000000-john-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'John Miller'),
    
    -- Kids/Youth
    ('p0000000-amyw-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Amy White'),
    ('p0000000-kevi-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Kevin Taylor'),
    ('p0000000-jess-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Jessica Moore'),
    
    -- Other volunteers
    ('p0000000-dani-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Daniel Clark'),
    ('p0000000-soph-0000-0000-000000000000'::uuid, 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'Sophia Lewis')
ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────────
-- PERSON ROLE CAPABILITIES
-- (Who can do what, and how skilled they are)
-- ──────────────────────────────────────────────────

INSERT INTO person_role_capabilities (id, org_id, person_id, role_id, proficiency, is_primary, is_approved) VALUES
    -- Brian - Worship Leader (primary), also does vocals
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-bria-0000-0000-000000000000'::uuid, 'role0000-wldr-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-bria-0000-0000-000000000000'::uuid, 'role0000-vocl-0000-0000-000000000000'::uuid, 4, false, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-bria-0000-0000-000000000000'::uuid, 'role0000-guit-0000-0000-000000000000'::uuid, 3, false, true),
    
    -- Sarah - Lead vocalist
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-sara-0000-0000-000000000000'::uuid, 'role0000-vocl-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-sara-0000-0000-000000000000'::uuid, 'role0000-wldr-0000-0000-000000000000'::uuid, 3, false, true),
    
    -- Marcus - Vocalist
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-marc-0000-0000-000000000000'::uuid, 'role0000-vocl-0000-0000-000000000000'::uuid, 4, true, true),
    
    -- Rachel - Vocalist
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-rach-0000-0000-000000000000'::uuid, 'role0000-vocl-0000-0000-000000000000'::uuid, 4, true, true),
    
    -- Emily - Keys/Piano (can also lead)
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-emil-0000-0000-000000000000'::uuid, 'role0000-keys-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-emil-0000-0000-000000000000'::uuid, 'role0000-wldr-0000-0000-000000000000'::uuid, 4, false, true),
    
    -- James - Guitar
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-jame-0000-0000-000000000000'::uuid, 'role0000-guit-0000-0000-000000000000'::uuid, 5, true, true),
    
    -- Tyler - Bass
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-tyle-0000-0000-000000000000'::uuid, 'role0000-bass-0000-0000-000000000000'::uuid, 4, true, true),
    
    -- Alex - Drums
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-alex-0000-0000-000000000000'::uuid, 'role0000-drum-0000-0000-000000000000'::uuid, 5, true, true),
    
    -- Chris - Sound (primary), can also do video
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-chri-0000-0000-000000000000'::uuid, 'role0000-sond-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-chri-0000-0000-000000000000'::uuid, 'role0000-vido-0000-0000-000000000000'::uuid, 3, false, true),
    
    -- Jordan - Lights
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-jord-0000-0000-000000000000'::uuid, 'role0000-lght-0000-0000-000000000000'::uuid, 4, true, true),
    
    -- Sam - Video/ProPresenter
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-samp-0000-0000-000000000000'::uuid, 'role0000-vido-0000-0000-000000000000'::uuid, 5, true, true),
    
    -- Morgan - Livestream
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-morg-0000-0000-000000000000'::uuid, 'role0000-strm-0000-0000-000000000000'::uuid, 4, true, true),
    
    -- Hospitality team
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-lisa-0000-0000-000000000000'::uuid, 'role0000-gret-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-john-0000-0000-000000000000'::uuid, 'role0000-gret-0000-0000-000000000000'::uuid, 4, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-tomg-0000-0000-000000000000'::uuid, 'role0000-ushr-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-mari-0000-0000-000000000000'::uuid, 'role0000-coff-0000-0000-000000000000'::uuid, 5, true, true),
    
    -- Kids/Youth team
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-amyw-0000-0000-000000000000'::uuid, 'role0000-kidl-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-kevi-0000-0000-000000000000'::uuid, 'role0000-kidh-0000-0000-000000000000'::uuid, 4, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-jess-0000-0000-000000000000'::uuid, 'role0000-ythl-0000-0000-000000000000'::uuid, 5, true, true),
    
    -- Other
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-dani-0000-0000-000000000000'::uuid, 'role0000-pray-0000-0000-000000000000'::uuid, 5, true, true),
    (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, 'p0000000-soph-0000-0000-000000000000'::uuid, 'role0000-park-0000-0000-000000000000'::uuid, 4, true, true)
ON CONFLICT (person_id, role_id) DO NOTHING;


-- ──────────────────────────────────────────────────
-- SERVICE ROLE REQUIREMENTS
-- (How many of each role needed per service type)
-- ──────────────────────────────────────────────────

DO $$
DECLARE
    sunday_am_context_id UUID;
    wednesday_context_id UUID;
    youth_context_id UUID;
BEGIN
    SELECT id INTO sunday_am_context_id FROM contexts WHERE name = 'Sunday AM' AND org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
    SELECT id INTO wednesday_context_id FROM contexts WHERE name = 'Wednesday Night' AND org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
    SELECT id INTO youth_context_id FROM contexts WHERE name = 'Youth Service' AND org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;

    -- Sunday AM requirements
    IF sunday_am_context_id IS NOT NULL THEN
        INSERT INTO service_role_requirements (id, org_id, context_id, role_id, min_needed, max_needed) VALUES
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-wldr-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-vocl-0000-0000-000000000000'::uuid, 2, 4),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-keys-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-guit-0000-0000-000000000000'::uuid, 1, 2),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-bass-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-drum-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-sond-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-vido-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-strm-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-gret-0000-0000-000000000000'::uuid, 2, 4),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-ushr-0000-0000-000000000000'::uuid, 2, 3),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-kidl-0000-0000-000000000000'::uuid, 1, 2),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, sunday_am_context_id, 'role0000-kidh-0000-0000-000000000000'::uuid, 2, 4)
        ON CONFLICT (context_id, role_id) DO NOTHING;
    END IF;

    -- Wednesday Night requirements (smaller service)
    IF wednesday_context_id IS NOT NULL THEN
        INSERT INTO service_role_requirements (id, org_id, context_id, role_id, min_needed, max_needed) VALUES
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, 'role0000-wldr-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, 'role0000-vocl-0000-0000-000000000000'::uuid, 1, 2),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, 'role0000-keys-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, 'role0000-guit-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, 'role0000-sond-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, wednesday_context_id, 'role0000-vido-0000-0000-000000000000'::uuid, 1, 1)
        ON CONFLICT (context_id, role_id) DO NOTHING;
    END IF;

    -- Youth Service requirements
    IF youth_context_id IS NOT NULL THEN
        INSERT INTO service_role_requirements (id, org_id, context_id, role_id, min_needed, max_needed) VALUES
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, youth_context_id, 'role0000-ythl-0000-0000-000000000000'::uuid, 1, 2),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, youth_context_id, 'role0000-wldr-0000-0000-000000000000'::uuid, 1, 1),
            (gen_random_uuid(), 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid, youth_context_id, 'role0000-sond-0000-0000-000000000000'::uuid, 1, 1)
        ON CONFLICT (context_id, role_id) DO NOTHING;
    END IF;
END $$;


-- ──────────────────────────────────────────────────
-- MORE SERVICE GROUPS & INSTANCES
-- (Upcoming services for the next few weeks)
-- ──────────────────────────────────────────────────

DO $$
DECLARE
    sunday_am_context_id UUID;
    special_context_id UUID;
    main_campus_id UUID;
BEGIN
    SELECT id INTO sunday_am_context_id FROM contexts WHERE name = 'Sunday AM' AND org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
    SELECT id INTO special_context_id FROM contexts WHERE name = 'Special Events' AND org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
    SELECT id INTO main_campus_id FROM campuses WHERE name = 'Main Campus' AND org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;

    -- December 21, 2025
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

    -- December 25, 2025 (Christmas)
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

    -- December 28, 2025
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
-- SAMPLE SONGS
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
-- VERIFICATION QUERIES
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
