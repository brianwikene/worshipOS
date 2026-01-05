-- Migration: Song lyrics storage & arrangements
-- Adds raw lyric storage, parsed JSON, and song_arrangements table

BEGIN;

-- -----------------------------------------------------------------
-- 1. Songs table enhancements
-- -----------------------------------------------------------------
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS source_format TEXT NOT NULL DEFAULT 'plain_text' CHECK (source_format IN ('plain_text', 'chordpro'));

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS parsed_json JSONB NOT NULL DEFAULT jsonb_build_object('format', 'plain_text', 'sections', jsonb_build_array(), 'warnings', jsonb_build_array(), 'generated_at', now());

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN songs.source_format IS 'Indicates whether lyrics were entered as plain text or ChordPro';
COMMENT ON COLUMN songs.raw_text IS 'Original user-submitted lyrics/chords text blob';
COMMENT ON COLUMN songs.parsed_json IS 'Server-side parsed representation of lyrics + chords';
COMMENT ON COLUMN songs.updated_at IS 'Auto-managed last update timestamp';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'songs_updated_at'
  ) THEN
    CREATE TRIGGER songs_updated_at
      BEFORE UPDATE ON songs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 2. song_arrangements table
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS song_arrangements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  key TEXT,
  bpm INTEGER,
  time_signature TEXT,
  structure JSONB NOT NULL DEFAULT jsonb_build_object('flow', jsonb_build_array()),
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT song_arrangements_unique_name UNIQUE (church_id, song_id, name)
);

COMMENT ON TABLE song_arrangements IS 'Different arrangements/structures for a single song';
COMMENT ON COLUMN song_arrangements.structure IS 'JSON payload describing section order and repeats';

CREATE INDEX IF NOT EXISTS idx_song_arrangements_song ON song_arrangements(song_id);
CREATE INDEX IF NOT EXISTS idx_song_arrangements_church ON song_arrangements(church_id);
CREATE INDEX IF NOT EXISTS idx_song_arrangements_default ON song_arrangements(song_id) WHERE is_default = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'song_arrangements_updated_at'
  ) THEN
    CREATE TRIGGER song_arrangements_updated_at
      BEFORE UPDATE ON song_arrangements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 3. Service instance song metadata
-- -----------------------------------------------------------------
ALTER TABLE service_instance_songs
  ADD COLUMN IF NOT EXISTS arrangement_id UUID REFERENCES song_arrangements(id) ON DELETE SET NULL;

ALTER TABLE service_instance_songs
  ADD COLUMN IF NOT EXISTS transpose_steps INTEGER DEFAULT 0;

ALTER TABLE service_instance_songs
  ADD COLUMN IF NOT EXISTS custom_structure JSONB;

CREATE INDEX IF NOT EXISTS idx_service_instance_songs_arrangement ON service_instance_songs(arrangement_id);

COMMENT ON COLUMN service_instance_songs.arrangement_id IS 'Arrangement selection for this service slot';
COMMENT ON COLUMN service_instance_songs.transpose_steps IS 'Transpose steps relative to arrangement key';
COMMENT ON COLUMN service_instance_songs.custom_structure IS 'Per-service overrides to arrangement structure';

COMMIT;
