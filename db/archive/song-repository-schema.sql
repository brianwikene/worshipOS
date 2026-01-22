-- /db/archive/song-repository-schema.sql
-- =====================================================
-- SONG REPOSITORY SCHEMA - Phase 1
-- Sections, Arrangements, and Service Integration
-- =====================================================

-- ==========================================
-- SONG_SECTIONS Table
-- Store verses, choruses, bridges with lyrics and chords
-- ==========================================
CREATE TABLE song_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  
  -- Section identity
  section_type text NOT NULL, -- 'verse', 'chorus', 'bridge', 'pre_chorus', 'tag', 'intro', 'outro'
  section_number int, -- 1, 2, 3 for verses; NULL for unique sections like chorus
  label text NOT NULL, -- "Verse 1", "Chorus", "Bridge"
  
  -- Content
  lyrics text NOT NULL, -- Plain text lyrics
  chords jsonb, -- Chord placement data (position-based)
  
  -- Metadata
  display_order int NOT NULL,
  notes text, -- Performance notes: "Build here", "Quiet", "Male lead"
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_song_sections_song ON song_sections(song_id, display_order);
CREATE INDEX idx_song_sections_org ON song_sections(org_id);

COMMENT ON TABLE song_sections IS 'Individual sections (verses, choruses) of songs with lyrics and chords';
COMMENT ON COLUMN song_sections.chords IS 'JSON: {lines: [{lyrics: "...", chords: [{position: 0, chord: "C"}]}]}';

-- ==========================================
-- SONG_ARRANGEMENTS Table
-- Different ways to play/structure the same song
-- ==========================================
CREATE TABLE song_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  
  -- Arrangement identity
  name text NOT NULL, -- "Standard", "Acoustic", "Extended Intro", "Simplified"
  description text,
  
  -- Musical details (can override song defaults)
  key text, -- "G", "C", "D", etc.
  bpm int,
  time_signature text, -- "4/4", "6/8", "3/4"
  
  -- Structure: which sections in what order
  structure jsonb NOT NULL, -- {flow: [{section_id: "uuid", repeat: 1, notes: "..."}]}
  
  -- Metadata
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES people(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_song_arrangement_name UNIQUE(song_id, name)
);

CREATE INDEX idx_song_arrangements_song ON song_arrangements(song_id);
CREATE INDEX idx_song_arrangements_org ON song_arrangements(org_id);
CREATE INDEX idx_song_arrangements_default ON song_arrangements(song_id, is_default) WHERE is_default = true;

COMMENT ON TABLE song_arrangements IS 'Different arrangements/versions of songs (Standard, Acoustic, etc)';
COMMENT ON COLUMN song_arrangements.structure IS 'JSON: {flow: [{section_id: "uuid", repeat: 1}]}';

-- ==========================================
-- Update SERVICE_INSTANCE_SONGS
-- Add arrangement and transposition support
-- ==========================================
DO $$
BEGIN
  -- Add arrangement_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_instance_songs' AND column_name = 'arrangement_id'
  ) THEN
    ALTER TABLE service_instance_songs 
    ADD COLUMN arrangement_id uuid REFERENCES song_arrangements(id) ON DELETE SET NULL;
    RAISE NOTICE '✓ Added arrangement_id to service_instance_songs';
  END IF;

  -- Add transpose_steps column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_instance_songs' AND column_name = 'transpose_steps'
  ) THEN
    ALTER TABLE service_instance_songs 
    ADD COLUMN transpose_steps int DEFAULT 0;
    RAISE NOTICE '✓ Added transpose_steps to service_instance_songs';
  END IF;

  -- Add custom_structure column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_instance_songs' AND column_name = 'custom_structure'
  ) THEN
    ALTER TABLE service_instance_songs 
    ADD COLUMN custom_structure jsonb;
    RAISE NOTICE '✓ Added custom_structure to service_instance_songs';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_instance_songs_arrangement ON service_instance_songs(arrangement_id);

COMMENT ON COLUMN service_instance_songs.arrangement_id IS 'Which arrangement to use for this service';
COMMENT ON COLUMN service_instance_songs.transpose_steps IS 'Transpose steps from arrangement key: +2 = up 2 semitones';
COMMENT ON COLUMN service_instance_songs.custom_structure IS 'Override arrangement structure for this specific service';

-- ==========================================
-- NOTIFICATION PREFERENCES Table
-- For future SMS/email integration
-- ==========================================
CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  
  -- Notification methods
  notify_via_email boolean DEFAULT true,
  notify_via_sms boolean DEFAULT false,
  
  -- Contact info
  email text,
  phone_number text, -- E.164 format: +12065551234
  
  -- Preferences
  auto_accept_roles text[], -- Array of role IDs to auto-accept
  require_confirmation boolean DEFAULT true,
  reminder_days_before int DEFAULT 3, -- Remind X days before service
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_person_notification_prefs UNIQUE(org_id, person_id)
);

CREATE INDEX idx_notification_prefs_person ON notification_preferences(person_id);

COMMENT ON TABLE notification_preferences IS 'How each person wants to be notified about scheduling';
COMMENT ON COLUMN notification_preferences.phone_number IS 'For SMS: E.164 format +12065551234';
COMMENT ON COLUMN notification_preferences.auto_accept_roles IS 'Role IDs that should auto-confirm without prompt';

-- ==========================================
-- ASSIGNMENT_NOTIFICATIONS Table
-- Track what notifications were sent
-- ==========================================
CREATE TABLE assignment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES service_assignments(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  
  -- Notification details
  notification_type text NOT NULL, -- 'email', 'sms', 'in_app'
  sent_at timestamptz NOT NULL DEFAULT now(),
  
  -- Response tracking
  response_method text, -- 'sms_reply', 'web_click', 'email_click'
  responded_at timestamptz,
  
  -- Content
  message_body text,
  delivery_status text, -- 'sent', 'delivered', 'failed', 'bounced'
  
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_assignment_notifications_assignment ON assignment_notifications(assignment_id);
CREATE INDEX idx_assignment_notifications_person ON assignment_notifications(person_id);

COMMENT ON TABLE assignment_notifications IS 'Tracks scheduling notifications sent to volunteers';
COMMENT ON COLUMN assignment_notifications.response_method IS 'How they responded: SMS Y/N, web click, etc';

-- ==========================================
-- SAMPLE DATA: Add sections for Way Maker
-- ==========================================
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_way_maker_id uuid;
  v_verse1_id uuid;
  v_chorus_id uuid;
  v_verse2_id uuid;
  v_bridge_id uuid;
BEGIN
  -- Get Way Maker song ID
  SELECT id INTO v_way_maker_id 
  FROM songs 
  WHERE org_id = v_org_id AND title = 'Way Maker'
  LIMIT 1;
  
  IF v_way_maker_id IS NULL THEN
    RAISE NOTICE 'Way Maker song not found, skipping sample data';
    RETURN;
  END IF;
  
  -- Verse 1
  INSERT INTO song_sections (org_id, song_id, section_type, section_number, label, lyrics, chords, display_order)
  VALUES (
    v_org_id,
    v_way_maker_id,
    'verse',
    1,
    'Verse 1',
    E'You are here, moving in our midst\nI worship You, I worship You\nYou are here, working in this place\nI worship You, I worship You',
    '{
      "lines": [
        {
          "lyrics": "You are here, moving in our midst",
          "chords": [
            {"position": 0, "chord": "C"},
            {"position": 12, "chord": "G/B"},
            {"position": 23, "chord": "Am7"}
          ]
        },
        {
          "lyrics": "I worship You, I worship You",
          "chords": [
            {"position": 2, "chord": "F"},
            {"position": 14, "chord": "C"}
          ]
        },
        {
          "lyrics": "You are here, working in this place",
          "chords": [
            {"position": 0, "chord": "C"},
            {"position": 12, "chord": "G/B"},
            {"position": 24, "chord": "Am7"}
          ]
        },
        {
          "lyrics": "I worship You, I worship You",
          "chords": [
            {"position": 2, "chord": "F"},
            {"position": 14, "chord": "C"}
          ]
        }
      ]
    }'::jsonb,
    1
  ) RETURNING id INTO v_verse1_id;
  
  -- Chorus
  INSERT INTO song_sections (org_id, song_id, section_type, label, lyrics, chords, display_order)
  VALUES (
    v_org_id,
    v_way_maker_id,
    'chorus',
    'Chorus',
    E'Way maker, miracle worker\nPromise keeper, light in the darkness\nMy God, that is who You are',
    '{
      "lines": [
        {
          "lyrics": "Way maker, miracle worker",
          "chords": [
            {"position": 0, "chord": "C"},
            {"position": 11, "chord": "G"}
          ]
        },
        {
          "lyrics": "Promise keeper, light in the darkness",
          "chords": [
            {"position": 0, "chord": "Am7"},
            {"position": 16, "chord": "F"}
          ]
        },
        {
          "lyrics": "My God, that is who You are",
          "chords": [
            {"position": 0, "chord": "C/E"},
            {"position": 8, "chord": "G"}
          ]
        }
      ]
    }'::jsonb,
    2
  ) RETURNING id INTO v_chorus_id;
  
  -- Verse 2
  INSERT INTO song_sections (org_id, song_id, section_type, section_number, label, lyrics, display_order)
  VALUES (
    v_org_id,
    v_way_maker_id,
    'verse',
    2,
    'Verse 2',
    E'You are here, touching every heart\nI worship You, I worship You\nYou are here, healing every heart\nI worship You, I worship You',
    1, -- Same chords as verse 1
    3
  ) RETURNING id INTO v_verse2_id;
  
  -- Bridge
  INSERT INTO song_sections (org_id, song_id, section_type, label, lyrics, chords, display_order)
  VALUES (
    v_org_id,
    v_way_maker_id,
    'bridge',
    'Bridge',
    E'Even when I don''t see it, You''re working\nEven when I don''t feel it, You''re working\nYou never stop, You never stop working',
    '{
      "lines": [
        {
          "lyrics": "Even when I don''t see it, You''re working",
          "chords": [
            {"position": 0, "chord": "C"},
            {"position": 25, "chord": "G"}
          ]
        },
        {
          "lyrics": "Even when I don''t feel it, You''re working",
          "chords": [
            {"position": 0, "chord": "Am7"},
            {"position": 26, "chord": "F"}
          ]
        },
        {
          "lyrics": "You never stop, You never stop working",
          "chords": [
            {"position": 0, "chord": "C"},
            {"position": 16, "chord": "G"}
          ]
        }
      ]
    }'::jsonb,
    4
  ) RETURNING id INTO v_bridge_id;
  
  -- Create Standard Arrangement
  INSERT INTO song_arrangements (org_id, song_id, name, key, bpm, time_signature, is_default, structure)
  VALUES (
    v_org_id,
    v_way_maker_id,
    'Standard',
    'C',
    72,
    '4/4',
    true,
    jsonb_build_object(
      'flow', jsonb_build_array(
        jsonb_build_object('section_id', v_verse1_id, 'repeat', 1),
        jsonb_build_object('section_id', v_chorus_id, 'repeat', 1),
        jsonb_build_object('section_id', v_verse2_id, 'repeat', 1),
        jsonb_build_object('section_id', v_chorus_id, 'repeat', 1),
        jsonb_build_object('section_id', v_bridge_id, 'repeat', 2),
        jsonb_build_object('section_id', v_chorus_id, 'repeat', 2)
      )
    )
  );
  
  RAISE NOTICE '✓ Created Way Maker sections and arrangement';
END $$;

COMMIT;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- View all sections for Way Maker
SELECT 
  ss.label,
  ss.section_type,
  ss.lyrics,
  jsonb_pretty(ss.chords) as chords
FROM song_sections ss
JOIN songs s ON s.id = ss.song_id
WHERE s.title = 'Way Maker'
ORDER BY ss.display_order;

-- View arrangements
SELECT 
  s.title as song_title,
  sa.name as arrangement_name,
  sa.key,
  sa.bpm,
  sa.is_default,
  jsonb_pretty(sa.structure) as structure
FROM song_arrangements sa
JOIN songs s ON s.id = sa.song_id
WHERE s.title = 'Way Maker';
