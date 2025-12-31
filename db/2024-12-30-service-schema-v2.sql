-- ============================================================================
-- WORSHIPOS SERVICE SCHEMA V2
-- Migration: 2024-12-30
--
-- Purpose: Enhanced service management with:
--   - Service types (recurring patterns)
--   - Ministry areas as first-class entities
--   - Template sections with ownership
--   - Service locking and amendments
--   - Audit trail for "system never lies"
--   - Future-proof auth hooks
--
-- Philosophy: The system never lies - we archive, never delete
-- ============================================================================

-- ============================================================================
-- PREREQUISITES
-- ============================================================================

-- Ensure pgcrypto is available for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 1. MINISTRY AREAS
-- First-class entities for ownership and future permission scoping
-- ============================================================================

CREATE TABLE IF NOT EXISTS ministry_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,                           -- 'worship', 'pastoral', 'kids'
  display_name TEXT NOT NULL,                   -- 'Worship Ministry'
  description TEXT,

  -- Display
  color TEXT,                                   -- Hex color for UI (#3B82F6)
  icon TEXT,                                    -- Icon identifier (music, book, users)
  display_order INTEGER DEFAULT 0,

  -- Hierarchy (optional)
  parent_id UUID REFERENCES ministry_areas(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES people(id) ON DELETE SET NULL,

  CONSTRAINT unique_church_ministry_area UNIQUE (church_id, name)
);

COMMENT ON TABLE ministry_areas IS
  'Ministry divisions within a church. Used for section ownership, role categorization, and future permission scoping.';
COMMENT ON COLUMN ministry_areas.name IS 'Lowercase identifier: worship, pastoral, kids, youth, hospitality, tech, admin';
COMMENT ON COLUMN ministry_areas.parent_id IS 'Optional hierarchy: e.g., "av" under "tech"';
COMMENT ON COLUMN ministry_areas.archived_at IS 'Soft delete - never remove data';

CREATE INDEX idx_ministry_areas_church ON ministry_areas(church_id);
CREATE INDEX idx_ministry_areas_active ON ministry_areas(church_id) WHERE is_active = true;
CREATE INDEX idx_ministry_areas_parent ON ministry_areas(parent_id) WHERE parent_id IS NOT NULL;


-- ============================================================================
-- 2. SERVICE TYPES (Recurring Patterns)
-- "Sunday AM" happens every Sunday at 9am & 11am
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,                           -- "Sunday AM", "Wednesday Night"
  description TEXT,
  context_id UUID REFERENCES contexts(id) ON DELETE SET NULL,

  -- Recurrence Pattern (RRULE-inspired)
  recurrence_rule JSONB NOT NULL DEFAULT '{"frequency": "weekly", "day_of_week": ["sunday"]}',
  -- {
  --   "frequency": "weekly" | "biweekly" | "monthly" | "custom",
  --   "day_of_week": ["sunday", "wednesday"],
  --   "week_of_month": [1, 3],  -- For "first and third Sunday"
  --   "exceptions": ["2024-12-25", "2024-12-31"],
  --   "custom_dates": ["2024-04-09"]  -- For special services
  -- }

  -- Default Template
  default_template_id UUID REFERENCES service_templates(id) ON DELETE SET NULL,

  -- Default Times (can spawn multiple instances per occurrence)
  default_times JSONB NOT NULL DEFAULT '[]',
  -- [
  --   {"time": "09:00", "label": "Early Service", "campus_ids": ["uuid1"]},
  --   {"time": "11:00", "label": "Late Service", "campus_ids": ["uuid1", "uuid2"]}
  -- ]

  -- Planning defaults
  planning_lead_days INTEGER DEFAULT 14,        -- How far ahead to generate services

  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES people(id) ON DELETE SET NULL,

  CONSTRAINT unique_church_service_type UNIQUE (church_id, name)
);

COMMENT ON TABLE service_types IS
  'Recurring service patterns. Defines when services happen and with what defaults.';
COMMENT ON COLUMN service_types.recurrence_rule IS
  'RRULE-like pattern for generating service dates. See JSONB structure in comments.';
COMMENT ON COLUMN service_types.default_times IS
  'Array of time slots with optional campus assignments for multi-campus or multi-service days.';

CREATE INDEX idx_service_types_church ON service_types(church_id);
CREATE INDEX idx_service_types_active ON service_types(church_id) WHERE is_active = true;
CREATE INDEX idx_service_types_context ON service_types(context_id);


-- ============================================================================
-- 3. ENHANCE SERVICE_TEMPLATES
-- Add versioning, archival, and audit fields
-- ============================================================================

ALTER TABLE service_templates
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_template_id UUID REFERENCES service_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES people(id) ON DELETE SET NULL;

COMMENT ON COLUMN service_templates.version IS 'Version number - incremented on significant changes';
COMMENT ON COLUMN service_templates.parent_template_id IS 'If this template was derived from another';
COMMENT ON COLUMN service_templates.archived_at IS 'Soft delete timestamp';


-- ============================================================================
-- 4. TEMPLATE SECTIONS
-- Defines sections within a template with ownership
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES service_templates(id) ON DELETE CASCADE,

  -- Section Identity
  display_order INTEGER NOT NULL,
  name TEXT NOT NULL,                           -- "Worship Set", "Message", "Announcements"
  section_type TEXT NOT NULL,                   -- 'worship', 'message', 'announcement', 'transition', 'other'

  -- Timing (relative to service start)
  relative_start_minutes INTEGER,               -- Minutes from service start
  estimated_duration_minutes INTEGER,
  is_flexible_timing BOOLEAN DEFAULT false,     -- Can shift based on flow?

  -- OWNERSHIP (Ministry-based, for future auth)
  ministry_area_id UUID REFERENCES ministry_areas(id) ON DELETE SET NULL,

  -- Future-proof: Additional ownership rules
  ownership_config JSONB DEFAULT '{}',
  -- Future structure:
  -- {
  --   "require_approval": true,
  --   "approver_system_role": "worship_director",
  --   "campus_scope": "inherit" | "all" | "uuid",
  --   "allow_delegation": true
  -- }

  -- Section Configuration
  config JSONB DEFAULT '{}',
  -- For worship: {"min_songs": 3, "max_songs": 6, "allow_hymns": true}
  -- For message: {"requires_scripture": true, "requires_title": true}
  -- For announcements: {"max_items": 5}

  -- Default content (optional)
  default_content JSONB,

  -- Requirements
  is_required BOOLEAN DEFAULT true,

  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES people(id) ON DELETE SET NULL,

  CONSTRAINT unique_template_section_order UNIQUE (template_id, display_order),
  CONSTRAINT valid_section_type CHECK (
    section_type IN ('worship', 'message', 'announcement', 'prayer', 'offering',
                     'communion', 'baptism', 'transition', 'video', 'other')
  )
);

COMMENT ON TABLE template_sections IS
  'Sections within a service template. ministry_area_id determines ownership for future authorization.';
COMMENT ON COLUMN template_sections.ministry_area_id IS
  'Which ministry owns this section. Future auth will use this for edit permissions.';
COMMENT ON COLUMN template_sections.ownership_config IS
  'Extensible configuration for future authorization system. Reserved for future use.';

CREATE INDEX idx_template_sections_template ON template_sections(template_id);
CREATE INDEX idx_template_sections_ministry ON template_sections(ministry_area_id);


-- ============================================================================
-- 5. ENHANCE SERVICE_INSTANCES
-- Add status, locking, and audit fields
-- ============================================================================

ALTER TABLE service_instances
  ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES service_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES service_templates(id) ON DELETE SET NULL,

  -- Status workflow
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',

  -- Locking mechanism
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lock_reason TEXT,

  -- Completion
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Archive (never delete)
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES people(id) ON DELETE SET NULL;

-- Add constraint for status (handle existing data gracefully)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_instance_status'
  ) THEN
    ALTER TABLE service_instances
      ADD CONSTRAINT chk_service_instance_status
      CHECK (status IN ('draft', 'scheduled', 'locked', 'completed', 'cancelled'));
  END IF;
END $$;

COMMENT ON COLUMN service_instances.status IS
  'Workflow: draft (editable) -> scheduled (planned) -> locked (finalized) -> completed (done)';
COMMENT ON COLUMN service_instances.locked_at IS
  'Once locked, direct edits are prevented. Only amendments can record changes.';
COMMENT ON COLUMN service_instances.archived_at IS
  'Soft delete - services are never truly deleted for historical accuracy.';

CREATE INDEX IF NOT EXISTS idx_service_instances_status ON service_instances(status);
CREATE INDEX IF NOT EXISTS idx_service_instances_service_type ON service_instances(service_type_id);
CREATE INDEX IF NOT EXISTS idx_service_instances_locked ON service_instances(church_id, locked_at) WHERE locked_at IS NOT NULL;


-- ============================================================================
-- 6. SERVICE INSTANCE SECTIONS
-- Actual sections for a specific service
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_instance_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_instance_id UUID NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
  template_section_id UUID REFERENCES template_sections(id) ON DELETE SET NULL,

  -- Identity (can override template)
  display_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  section_type TEXT NOT NULL,

  -- Ownership (inherited from template or overridden)
  ministry_area_id UUID REFERENCES ministry_areas(id) ON DELETE SET NULL,

  -- Timing (planned)
  planned_start_time TIME,
  planned_duration_minutes INTEGER,

  -- Timing (actual - filled after service)
  actual_start_time TIME,
  actual_duration_minutes INTEGER,

  -- Content (flexible per section type)
  content JSONB DEFAULT '{}',
  -- For worship: {"notes": "Extended worship today"}
  -- For message: {"title": "Grace Abounds", "speaker_id": "uuid", "scripture_refs": ["John 3:16"]}
  -- For announcements: {"items": [{"title": "...", "details": "..."}]}

  -- Status workflow
  status TEXT DEFAULT 'pending',

  -- Readiness tracking
  marked_ready_at TIMESTAMPTZ,
  marked_ready_by UUID REFERENCES people(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES people(id) ON DELETE SET NULL,

  CONSTRAINT unique_instance_section_order UNIQUE (service_instance_id, display_order),
  CONSTRAINT valid_instance_section_status CHECK (
    status IN ('pending', 'draft', 'ready', 'approved', 'completed', 'skipped')
  )
);

COMMENT ON TABLE service_instance_sections IS
  'Actual sections for a specific service instance. Links to template but allows overrides.';
COMMENT ON COLUMN service_instance_sections.actual_start_time IS
  'Filled after service to record what actually happened (for reporting/care insights).';

CREATE INDEX idx_instance_sections_service ON service_instance_sections(service_instance_id);
CREATE INDEX idx_instance_sections_ministry ON service_instance_sections(ministry_area_id);
CREATE INDEX idx_instance_sections_status ON service_instance_sections(status);


-- ============================================================================
-- 7. SERVICE AMENDMENTS
-- Records what actually happened vs what was planned ("system never lies")
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_instance_id UUID NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,

  -- What was amended?
  amendment_type TEXT NOT NULL,
  -- 'song_change', 'song_skip', 'song_add', 'section_skip', 'section_add',
  -- 'timing_change', 'personnel_change', 'order_change', 'general_note'

  -- Reference to what was changed (polymorphic)
  reference_table TEXT,                         -- 'service_instance_songs', 'service_instance_sections'
  reference_id UUID,                            -- ID of the record that was changed

  -- The change details
  planned_value JSONB,                          -- What was originally planned
  actual_value JSONB,                           -- What actually happened

  -- Context
  reason TEXT,                                  -- "Switched for communion emphasis"
  notes TEXT,                                   -- Additional context

  -- For CCLI reporting
  ccli_relevant BOOLEAN DEFAULT false,
  ccli_song_number TEXT,                        -- CCLI song number if applicable

  -- Audit
  recorded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  recorded_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,

  -- Optional verification (second person confirmation)
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES people(id) ON DELETE SET NULL,

  CONSTRAINT valid_amendment_type CHECK (
    amendment_type IN (
      'song_change', 'song_skip', 'song_add',
      'section_skip', 'section_add', 'section_reorder',
      'timing_change', 'personnel_change', 'order_change',
      'general_note'
    )
  )
);

COMMENT ON TABLE service_amendments IS
  'Records differences between planned and actual service execution. Core to "system never lies" philosophy.';
COMMENT ON COLUMN service_amendments.ccli_relevant IS
  'Flag for amendments affecting CCLI reporting (song changes/skips).';
COMMENT ON COLUMN service_amendments.recorded_by IS
  'RESTRICT delete - we must always know who recorded an amendment.';

CREATE INDEX idx_amendments_service ON service_amendments(service_instance_id);
CREATE INDEX idx_amendments_type ON service_amendments(amendment_type);
CREATE INDEX idx_amendments_ccli ON service_amendments(church_id) WHERE ccli_relevant = true;
CREATE INDEX idx_amendments_recorded ON service_amendments(recorded_at DESC);


-- ============================================================================
-- 8. ENHANCE SERVICE_INSTANCE_SONGS
-- Track planned vs actual, CCLI reporting
-- ============================================================================

ALTER TABLE service_instance_songs
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES service_instance_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS was_performed BOOLEAN,
  ADD COLUMN IF NOT EXISTS actual_key TEXT,
  ADD COLUMN IF NOT EXISTS ccli_reported BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ccli_report_date DATE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES people(id) ON DELETE SET NULL;

COMMENT ON COLUMN service_instance_songs.section_id IS
  'Links song to a specific section (e.g., opening worship vs closing).';
COMMENT ON COLUMN service_instance_songs.was_performed IS
  'NULL = pending, true = performed, false = skipped. Set after service.';
COMMENT ON COLUMN service_instance_songs.actual_key IS
  'Key actually used if different from planned.';
COMMENT ON COLUMN service_instance_songs.ccli_reported IS
  'Has this song usage been included in CCLI report?';

CREATE INDEX IF NOT EXISTS idx_instance_songs_section ON service_instance_songs(section_id);
CREATE INDEX IF NOT EXISTS idx_instance_songs_performed ON service_instance_songs(service_instance_id)
  WHERE was_performed = true;
CREATE INDEX IF NOT EXISTS idx_instance_songs_ccli_pending ON service_instance_songs(ccli_reported)
  WHERE was_performed = true AND ccli_reported = false;


-- ============================================================================
-- 9. SERVICE AUDIT LOG
-- Complete change history for accountability
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,

  -- What changed?
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,                         -- 'insert', 'update', 'delete', 'lock', 'unlock'

  -- Change details
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  -- Context
  change_reason TEXT,

  -- Who and when
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  changed_by UUID REFERENCES people(id) ON DELETE SET NULL,

  -- If this was an amendment to a locked service
  is_amendment BOOLEAN DEFAULT false,
  amendment_id UUID REFERENCES service_amendments(id) ON DELETE SET NULL,

  CONSTRAINT valid_audit_action CHECK (
    action IN ('insert', 'update', 'delete', 'lock', 'unlock', 'archive', 'restore')
  )
);

COMMENT ON TABLE service_audit_log IS
  'Complete audit trail for all service-related changes. Supports "system never lies" philosophy.';

CREATE INDEX idx_audit_table_record ON service_audit_log(table_name, record_id);
CREATE INDEX idx_audit_changed_at ON service_audit_log(changed_at DESC);
CREATE INDEX idx_audit_church_date ON service_audit_log(church_id, changed_at DESC);


-- ============================================================================
-- 10. ENHANCE PEOPLE TABLE FOR SOUL CARE HOOKS
-- Add fields that Soul Care system will use
-- ============================================================================

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS first_visit_date DATE,
  ADD COLUMN IF NOT EXISTS membership_date DATE,
  ADD COLUMN IF NOT EXISTS care_notes_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_known_attendance DATE;

COMMENT ON COLUMN people.membership_status IS
  'Lifecycle stage: visitor, regular, member, leader, inactive, unknown';
COMMENT ON COLUMN people.care_notes_enabled IS
  'Privacy setting: if false, pastoral/care notes cannot be recorded for this person.';
COMMENT ON COLUMN people.last_known_attendance IS
  'Denormalized field for quick "haven''t seen since" queries. Updated by attendance system.';


-- ============================================================================
-- 11. HELPFUL VIEWS
-- ============================================================================

-- View: Service status with readiness metrics
CREATE OR REPLACE VIEW v_service_status_v2 AS
SELECT
  si.id,
  si.church_id,
  sg.group_date,
  sg.name AS service_name,
  si.service_time,
  c.name AS campus_name,
  st.name AS service_type_name,
  si.status,
  si.locked_at,
  lp.display_name AS locked_by_name,
  si.completed_at,

  -- Section readiness
  (SELECT COUNT(*) FROM service_instance_sections
   WHERE service_instance_id = si.id) AS total_sections,
  (SELECT COUNT(*) FROM service_instance_sections
   WHERE service_instance_id = si.id AND status IN ('ready', 'approved', 'completed')) AS ready_sections,

  -- Amendment count
  (SELECT COUNT(*) FROM service_amendments
   WHERE service_instance_id = si.id) AS amendment_count,

  -- Songs
  (SELECT COUNT(*) FROM service_instance_songs
   WHERE service_instance_id = si.id) AS planned_songs,
  (SELECT COUNT(*) FROM service_instance_songs
   WHERE service_instance_id = si.id AND was_performed = true) AS performed_songs

FROM service_instances si
JOIN service_groups sg ON sg.id = si.service_group_id
LEFT JOIN campuses c ON c.id = si.campus_id
LEFT JOIN service_types st ON st.id = si.service_type_id
LEFT JOIN people lp ON lp.id = si.locked_by
WHERE si.archived_at IS NULL;

COMMENT ON VIEW v_service_status_v2 IS
  'Service instances with status, readiness, and amendment metrics.';


-- View: CCLI reporting (songs actually performed)
CREATE OR REPLACE VIEW v_ccli_report_v2 AS
SELECT
  si.church_id,
  sg.group_date AS service_date,
  si.service_time,
  s.title AS song_title,
  s.ccli_number,
  COALESCE(sis.actual_key, sis.key, s.key) AS key_performed,
  sis.was_performed,
  sis.ccli_reported,
  sis.ccli_report_date,

  -- Include any amendments
  sa.amendment_type,
  sa.actual_value->>'song_title' AS substituted_with,
  sa.actual_value->>'ccli_number' AS substituted_ccli_number

FROM service_instance_songs sis
JOIN service_instances si ON si.id = sis.service_instance_id
JOIN service_groups sg ON sg.id = si.service_group_id
JOIN songs s ON s.id = sis.song_id
LEFT JOIN service_amendments sa ON sa.reference_id = sis.id
  AND sa.reference_table = 'service_instance_songs'
  AND sa.ccli_relevant = true
WHERE si.status = 'completed'
  AND (sis.was_performed = true OR sa.id IS NOT NULL);

COMMENT ON VIEW v_ccli_report_v2 IS
  'View for CCLI reporting - shows performed songs including substitutions via amendments.';


-- View: Ministry area section ownership
CREATE OR REPLACE VIEW v_section_ownership AS
SELECT
  ts.id AS template_section_id,
  st.name AS template_name,
  ts.name AS section_name,
  ts.section_type,
  ts.display_order,
  ma.id AS ministry_area_id,
  ma.name AS ministry_area,
  ma.display_name AS ministry_display_name,
  ts.is_required,
  ts.estimated_duration_minutes

FROM template_sections ts
JOIN service_templates st ON st.id = ts.template_id
LEFT JOIN ministry_areas ma ON ma.id = ts.ministry_area_id
WHERE ts.is_active = true
  AND st.is_active = true
ORDER BY st.name, ts.display_order;

COMMENT ON VIEW v_section_ownership IS
  'Shows which ministry area owns each template section - useful for future auth system.';


-- ============================================================================
-- 12. FUNCTIONS
-- ============================================================================

-- Lock a service instance
CREATE OR REPLACE FUNCTION lock_service_instance(
  p_service_instance_id UUID,
  p_locked_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM service_instances
  WHERE id = p_service_instance_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Service instance not found: %', p_service_instance_id;
  END IF;

  IF v_current_status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'Cannot lock service with status: %', v_current_status;
  END IF;

  UPDATE service_instances
  SET
    status = 'locked',
    locked_at = now(),
    locked_by = p_locked_by,
    lock_reason = p_reason,
    updated_at = now(),
    updated_by = p_locked_by
  WHERE id = p_service_instance_id;

  -- Log the lock action
  INSERT INTO service_audit_log (
    church_id, table_name, record_id, action,
    new_values, change_reason, changed_by
  )
  SELECT
    church_id, 'service_instances', id, 'lock',
    jsonb_build_object('status', 'locked', 'locked_at', now()),
    p_reason, p_locked_by
  FROM service_instances
  WHERE id = p_service_instance_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION lock_service_instance IS
  'Lock a service to prevent direct edits. Only amendments allowed after locking.';


-- Record a song amendment
CREATE OR REPLACE FUNCTION record_song_amendment(
  p_church_id UUID,
  p_service_instance_id UUID,
  p_song_instance_id UUID,
  p_amendment_type TEXT,
  p_actual_song_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_recorded_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_amendment_id UUID;
  v_original RECORD;
  v_actual_song RECORD;
BEGIN
  -- Get original song details
  SELECT
    sis.id,
    sis.song_id,
    s.title,
    s.ccli_number,
    sis.key
  INTO v_original
  FROM service_instance_songs sis
  JOIN songs s ON s.id = sis.song_id
  WHERE sis.id = p_song_instance_id;

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'Song instance not found: %', p_song_instance_id;
  END IF;

  -- Get actual song details if substitution
  IF p_actual_song_id IS NOT NULL THEN
    SELECT title, ccli_number
    INTO v_actual_song
    FROM songs
    WHERE id = p_actual_song_id;
  END IF;

  -- Create amendment record
  INSERT INTO service_amendments (
    church_id,
    service_instance_id,
    amendment_type,
    reference_table,
    reference_id,
    planned_value,
    actual_value,
    reason,
    ccli_relevant,
    ccli_song_number,
    recorded_by
  ) VALUES (
    p_church_id,
    p_service_instance_id,
    p_amendment_type,
    'service_instance_songs',
    p_song_instance_id,
    jsonb_build_object(
      'song_id', v_original.song_id,
      'song_title', v_original.title,
      'ccli_number', v_original.ccli_number,
      'key', v_original.key
    ),
    CASE
      WHEN p_amendment_type = 'song_skip' THEN
        jsonb_build_object('skipped', true)
      WHEN p_amendment_type = 'song_change' AND p_actual_song_id IS NOT NULL THEN
        jsonb_build_object(
          'song_id', p_actual_song_id,
          'song_title', v_actual_song.title,
          'ccli_number', v_actual_song.ccli_number
        )
      ELSE '{}'::jsonb
    END,
    p_reason,
    true,
    COALESCE(v_actual_song.ccli_number, v_original.ccli_number),
    p_recorded_by
  )
  RETURNING id INTO v_amendment_id;

  -- Update the song instance status
  UPDATE service_instance_songs
  SET
    status = CASE
      WHEN p_amendment_type = 'song_skip' THEN 'skipped'
      WHEN p_amendment_type = 'song_change' THEN 'substituted'
      ELSE status
    END,
    was_performed = (p_amendment_type != 'song_skip'),
    updated_at = now(),
    updated_by = p_recorded_by
  WHERE id = p_song_instance_id;

  RETURN v_amendment_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_song_amendment IS
  'Record when a song was skipped or substituted. Maintains planned/actual integrity for CCLI.';


-- Complete a service (mark as completed, set all performed flags)
CREATE OR REPLACE FUNCTION complete_service_instance(
  p_service_instance_id UUID,
  p_completed_by UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Update service status
  UPDATE service_instances
  SET
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    updated_at = now(),
    updated_by = p_completed_by
  WHERE id = p_service_instance_id
    AND status IN ('scheduled', 'locked');

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Mark all pending songs as performed (unless explicitly skipped)
  UPDATE service_instance_songs
  SET
    was_performed = COALESCE(was_performed, true),
    status = CASE
      WHEN status = 'planned' THEN 'performed'
      ELSE status
    END
  WHERE service_instance_id = p_service_instance_id
    AND status NOT IN ('skipped', 'substituted');

  -- Mark all sections as completed
  UPDATE service_instance_sections
  SET
    status = CASE
      WHEN status IN ('pending', 'draft', 'ready', 'approved') THEN 'completed'
      ELSE status
    END
  WHERE service_instance_id = p_service_instance_id;

  -- Log completion
  INSERT INTO service_audit_log (
    church_id, table_name, record_id, action,
    new_values, changed_by
  )
  SELECT
    church_id, 'service_instances', id, 'update',
    jsonb_build_object('status', 'completed', 'completed_at', now()),
    p_completed_by
  FROM service_instances
  WHERE id = p_service_instance_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_service_instance IS
  'Mark a service as completed and finalize all song/section statuses.';


-- ============================================================================
-- 13. MIGRATION TRACKING
-- ============================================================================

INSERT INTO schema_migrations (id, applied_at)
VALUES ('2024-12-30-service-schema-v2', now())
ON CONFLICT (id) DO NOTHING;
