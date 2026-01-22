-- /migrations/003_duplicate_detection.sql
-- Migration: Duplicate Detection & Merge System
-- Description: Adds tables and columns for duplicate detection, identity linking, and merge tracking

BEGIN;

-- ============================================================================
-- 1. Add columns to people table
-- ============================================================================

-- canonical_id: Points to the "survivor" record after merge. NULL = this is canonical.
ALTER TABLE people ADD COLUMN IF NOT EXISTS canonical_id UUID REFERENCES people(id) ON DELETE SET NULL;

-- merged_at: When this record was merged into another. NULL = active record.
ALTER TABLE people ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;

-- Legal names for official documents (background checks, legal forms)
ALTER TABLE people ADD COLUMN IF NOT EXISTS legal_first_name VARCHAR(100);
ALTER TABLE people ADD COLUMN IF NOT EXISTS legal_last_name VARCHAR(100);

-- Index for finding merged records
CREATE INDEX IF NOT EXISTS idx_people_canonical ON people(canonical_id) WHERE canonical_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_merged ON people(merged_at) WHERE merged_at IS NOT NULL;

-- ============================================================================
-- 2. Create identity_links table (soft links for possible duplicates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,

  -- The two people being linked (person_a_id < person_b_id to prevent duplicates)
  person_a_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  -- Link status
  status VARCHAR(20) NOT NULL DEFAULT 'suggested',
  -- 'suggested' = system detected, pending review
  -- 'confirmed' = admin confirmed as same person (pre-merge)
  -- 'not_match' = admin confirmed NOT same person
  -- 'merged' = these records have been merged

  -- Scoring & explanation
  confidence_score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
  match_reasons JSONB NOT NULL DEFAULT '[]',
  -- Example: [{"field": "email", "reason": "Exact email match", "weight": 40}]

  -- Detection metadata
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_by VARCHAR(50) NOT NULL DEFAULT 'system',
  -- 'system' = auto-detected, 'import:filename' = during import, 'manual' = admin created

  -- Review metadata
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES people(id) ON DELETE SET NULL,
  review_notes TEXT,

  -- Prevent re-suggesting after "not a match"
  suppressed_until TIMESTAMPTZ, -- NULL = not suppressed, timestamp = don't re-suggest until

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT identity_links_ordered CHECK (person_a_id < person_b_id),
  CONSTRAINT identity_links_unique UNIQUE (church_id, person_a_id, person_b_id),
  CONSTRAINT identity_links_status CHECK (status IN ('suggested', 'confirmed', 'not_match', 'merged'))
);

CREATE INDEX IF NOT EXISTS idx_identity_links_church ON identity_links(church_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_person_a ON identity_links(person_a_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_person_b ON identity_links(person_b_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_pending ON identity_links(church_id, status)
  WHERE status IN ('suggested', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_identity_links_review ON identity_links(church_id, status, confidence_score DESC);

-- ============================================================================
-- 3. Create merge_events table (audit log for merges)
-- ============================================================================

CREATE TABLE IF NOT EXISTS merge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,

  -- The merge operation
  survivor_id UUID NOT NULL REFERENCES people(id),
  -- The record that remains active

  merged_ids UUID[] NOT NULL,
  -- Array of person IDs that were merged into survivor (can merge multiple at once)

  -- Complete snapshot for undo
  merged_snapshots JSONB NOT NULL,
  -- Full copy of each merged record at time of merge:
  -- { "uuid-1": { "first_name": "...", "contact_methods": [...], ... }, ... }

  -- Field resolution decisions
  field_resolutions JSONB NOT NULL,
  -- Which fields came from which source:
  -- { "first_name": {"source": "survivor", "value": "John"},
  --   "email": {"source": "uuid-merged", "value": "john@example.com"} }

  -- What was transferred
  transferred_records JSONB DEFAULT '{}',
  -- { "service_assignments": 3, "role_capabilities": 1, "family_memberships": 1 }

  -- Audit trail
  performed_by UUID NOT NULL REFERENCES people(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT, -- Optional admin note

  -- Undo tracking
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES people(id),
  undo_reason TEXT,

  -- Link back to identity_link that triggered this (optional)
  identity_link_id UUID REFERENCES identity_links(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merge_events_church ON merge_events(church_id);
CREATE INDEX IF NOT EXISTS idx_merge_events_survivor ON merge_events(survivor_id);
CREATE INDEX IF NOT EXISTS idx_merge_events_merged ON merge_events USING GIN(merged_ids);
CREATE INDEX IF NOT EXISTS idx_merge_events_recent ON merge_events(church_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_merge_events_undoable ON merge_events(church_id)
  WHERE undone_at IS NULL;

-- ============================================================================
-- 4. Create person_aliases table (name variations for matching)
-- ============================================================================

CREATE TABLE IF NOT EXISTS person_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  alias_type VARCHAR(20) NOT NULL,
  -- 'legal', 'preferred', 'maiden', 'nickname', 'typo', 'merged'

  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200), -- For display purposes

  -- Where this alias came from
  source VARCHAR(100) NOT NULL DEFAULT 'manual',
  -- 'manual', 'merge:uuid', 'import:filename'

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT person_aliases_type CHECK (
    alias_type IN ('legal', 'preferred', 'maiden', 'nickname', 'typo', 'merged')
  )
);

CREATE INDEX IF NOT EXISTS idx_person_aliases_person ON person_aliases(person_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_church ON person_aliases(church_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_name ON person_aliases(church_id, LOWER(last_name), LOWER(first_name))
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_person_aliases_active ON person_aliases(person_id, alias_type)
  WHERE is_active = true;

-- ============================================================================
-- 5. Create helper function for updated_at trigger
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to identity_links
DROP TRIGGER IF EXISTS identity_links_updated_at ON identity_links;
CREATE TRIGGER identity_links_updated_at
  BEFORE UPDATE ON identity_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Create view for active (non-merged) people
-- ============================================================================

CREATE OR REPLACE VIEW active_people AS
SELECT *
FROM people
WHERE merged_at IS NULL
  AND is_active = true;

COMMIT;
