// /docs/worshipos-proposed-schema-v1a.md
# WorshipOS Database Schema v1.0
## A Pastoral Care System That Happens to Have Scheduling

**Last Updated:** December 22, 2025  
**Status:** Reference Document for Incremental Build

---

## Core Principles (Never Compromise)

1. **Soul care over logistics** — "How is your soul?" is a feature
2. **People over productivity** — Burnout prevention built in
3. **Presence over polish** — System adapts to the Spirit
4. **Context over control** — Local freedom within shared framework
5. **Formation over function** — Track discipleship journeys, not just tasks
6. **Sanity over sacrifice** — Healthy volunteers, not heroes or victims
7. **Global-ready** — Honor all cultures and languages from day one
8. **The system doesn't lie** — Full audit trail, point-in-time recovery, accountable integrations

---

## Schema Overview

### Foundational Tables
- `churches` — Multi-tenant root
- `people` — Core person records
- `addresses` — Shared address records
- `person_addresses` — Many-to-many junction

### Organizations & Affiliations
- `organizations` — Schools, employers, external orgs
- `person_affiliations` — Person-to-org relationships

### Ministry Structure
- `ministry_areas` — Worship, Hospitality, Kids, etc.
- `positions` — Specific roles within ministry areas
- `position_resources` — Body part / location constraints
- `resource_types` — hands, feet, mouth, presence
- `locations` — Physical spaces (Stage, Lobby, Nursery)
- `person_ministry_areas` — Volunteer pool with status

### Scheduling
- `schedule_requests` — Requests with response tracking
- `service_assignments` — Confirmed assignments

### Requirements & Clearances
- `requirements` — Church-defined prerequisites
- `person_requirements` — Completion records
- `person_clearances` — Background checks, certifications

### Pastoral Care
- `care_notes` — Private pastoral intelligence
- `care_requests` — Actionable followups with workflow
- `person_notes` — Life context for leadership

### Notifications
- `person_notification_preferences` — Channel + frequency by category

---

## Table Definitions

### SECTION A: System Infrastructure (Audit, Logging, Process Management)

These tables are foundational — they support everything else and embody the principle: **"The system doesn't lie."**

---

### system_actors
Who or what can make changes. Not just people — also scripts, integrations, migrations.

```sql
CREATE TABLE system_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  actor_type VARCHAR(50) NOT NULL,  -- 'person', 'integration', 'system', 'migration'
  
  -- If person
  person_id UUID REFERENCES people(id),
  
  -- If integration/script
  integration_name VARCHAR(100),     -- 'planning_center_sync', 'mailchimp_import'
  description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_system_actors_type ON system_actors(actor_type);
CREATE INDEX idx_system_actors_person ON system_actors(person_id);
```

---

### process_locks
Prevents overlapping job runs. "Don't start if I'm already running."

```sql
CREATE TABLE process_locks (
  process_name VARCHAR(100) PRIMARY KEY,
  
  -- Lock status
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by_run_id UUID,  -- References process_runs(id), added after that table exists
  
  -- Heartbeat (proves process is still alive)
  last_heartbeat TIMESTAMPTZ,
  
  -- Timing config
  expected_duration_minutes INT DEFAULT 60,   -- Normal run time
  lock_timeout_minutes INT DEFAULT 180,       -- When to assume dead and steal lock
  
  -- Job config
  is_enabled BOOLEAN DEFAULT true,            -- Can disable without removing
  max_concurrent INT DEFAULT 1,               -- Usually 1
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### process_runs
Every time an integration/job runs. Success or failure.

```sql
CREATE TABLE process_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What process
  process_name VARCHAR(100) NOT NULL,
  process_type VARCHAR(50) NOT NULL,   -- 'integration', 'migration', 'scheduled_job', 'manual', 'backup'
  
  -- When
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'running',  
    -- 'running', 'success', 'partial_success', 'failed', 'skipped', 'cancelled'
  skipped_reason VARCHAR(100),         -- 'previous_run_in_progress', 'manually_disabled'
  
  -- Scope
  records_attempted INT DEFAULT 0,
  records_succeeded INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  
  -- Context
  triggered_by UUID REFERENCES system_actors(id),
  parameters JSONB,                    -- Config passed to the process
  
  -- Summary
  summary TEXT,                        -- Human-readable outcome
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_process_runs_name ON process_runs(process_name);
CREATE INDEX idx_process_runs_status ON process_runs(status);
CREATE INDEX idx_process_runs_started ON process_runs(started_at DESC);
CREATE INDEX idx_process_runs_name_status ON process_runs(process_name, status, started_at DESC);

-- Add FK to process_locks after both tables exist
ALTER TABLE process_locks 
  ADD CONSTRAINT fk_locked_by_run 
  FOREIGN KEY (locked_by_run_id) REFERENCES process_runs(id);
```

---

### process_steps
Individual steps within a process run. For long-running jobs.

```sql
CREATE TABLE process_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_run_id UUID NOT NULL REFERENCES process_runs(id) ON DELETE CASCADE,
  
  -- What step
  step_number INT NOT NULL,
  step_name VARCHAR(100) NOT NULL,     -- 'fetch_people', 'validate_addresses', 'write_to_db'
  
  -- When
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'running',
    -- 'running', 'success', 'failed', 'skipped'
  
  -- Details
  records_processed INT DEFAULT 0,
  details JSONB,                       -- Step-specific metadata
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_process_steps_run ON process_steps(process_run_id);
CREATE INDEX idx_process_steps_status ON process_steps(status);
```

---

### process_errors
Errors and warnings from process runs. The troubleshooting goldmine.

```sql
CREATE TABLE process_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_run_id UUID NOT NULL REFERENCES process_runs(id) ON DELETE CASCADE,
  process_step_id UUID REFERENCES process_steps(id),
  
  -- Severity
  severity VARCHAR(20) NOT NULL DEFAULT 'error',  -- 'warning', 'error', 'critical'
  
  -- What happened
  error_code VARCHAR(100),             -- 'DUPLICATE_KEY', 'CONNECTION_TIMEOUT', 'VALIDATION_FAILED'
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  
  -- Context
  affected_table VARCHAR(100),
  affected_record_id UUID,
  attempted_operation VARCHAR(50),     -- 'insert', 'update', 'delete'
  attempted_data JSONB,                -- What we tried to write
  existing_data JSONB,                 -- What was already there (for debugging overwrites)
  
  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES system_actors(id),
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_process_errors_run ON process_errors(process_run_id);
CREATE INDEX idx_process_errors_step ON process_errors(process_step_id);
CREATE INDEX idx_process_errors_severity ON process_errors(severity);
CREATE INDEX idx_process_errors_unresolved ON process_errors(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_process_errors_table ON process_errors(affected_table);
CREATE INDEX idx_process_errors_record ON process_errors(affected_record_id);
```

---

### data_change_log
Universal audit trail. Every INSERT, UPDATE, DELETE on tracked tables.

```sql
CREATE TABLE data_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What changed
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  
  -- What happened
  action VARCHAR(20) NOT NULL,         -- 'insert', 'update', 'delete'
  
  -- Before/after snapshots
  old_data JSONB,                      -- NULL for inserts
  new_data JSONB,                      -- NULL for deletes
  changed_fields TEXT[],               -- ['first_name', 'email'] for updates
  
  -- Who did it
  changed_by UUID REFERENCES system_actors(id),
  change_reason TEXT,                  -- 'Return mail', 'Member update', 'PC sync'
  
  -- When
  changed_at TIMESTAMPTZ DEFAULT now(),
  
  -- For point-in-time recovery
  transaction_id BIGINT DEFAULT txid_current()
);

CREATE INDEX idx_data_change_log_table ON data_change_log(table_name);
CREATE INDEX idx_data_change_log_record ON data_change_log(record_id);
CREATE INDEX idx_data_change_log_changed_at ON data_change_log(changed_at DESC);
CREATE INDEX idx_data_change_log_actor ON data_change_log(changed_by);
CREATE INDEX idx_data_change_log_table_record ON data_change_log(table_name, record_id, changed_at DESC);
```

---

### Audit Trigger Function (Reusable)

Apply this trigger to any table that needs audit logging:

```sql
CREATE OR REPLACE FUNCTION log_data_change()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
  changed_cols TEXT[];
  col_name TEXT;
BEGIN
  -- Get current actor from session variable (set by application)
  actor_id := NULLIF(current_setting('app.current_actor_id', true), '')::UUID;
  
  -- Calculate changed fields for updates
  IF TG_OP = 'UPDATE' THEN
    FOR col_name IN SELECT column_name FROM information_schema.columns 
                    WHERE table_name = TG_TABLE_NAME 
                    AND table_schema = TG_TABLE_SCHEMA
    LOOP
      IF to_jsonb(OLD) -> col_name IS DISTINCT FROM to_jsonb(NEW) -> col_name THEN
        changed_cols := array_append(changed_cols, col_name);
      END IF;
    END LOOP;
  END IF;
  
  INSERT INTO data_change_log (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_fields,
    changed_by,
    change_reason
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    LOWER(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    changed_cols,
    actor_id,
    NULLIF(current_setting('app.change_reason', true), '')
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to a table (example):
-- CREATE TRIGGER audit_people
-- AFTER INSERT OR UPDATE OR DELETE ON people
-- FOR EACH ROW EXECUTE FUNCTION log_data_change();
```

---

### System Health Views

Pre-built queries for the System Health dashboard:

```sql
-- Overall process status
CREATE VIEW v_process_status AS
SELECT 
  pl.process_name,
  pl.is_enabled,
  pl.is_locked,
  pl.locked_at,
  pl.last_heartbeat,
  pl.expected_duration_minutes,
  pr.id as last_run_id,
  pr.status as last_run_status,
  pr.started_at as last_run_started,
  pr.completed_at as last_run_completed,
  pr.records_succeeded as last_run_succeeded,
  pr.records_failed as last_run_failed,
  pr.summary as last_run_summary,
  CASE 
    WHEN pl.is_locked AND pl.last_heartbeat < now() - INTERVAL '30 minutes' 
      THEN 'stale'
    WHEN pl.is_locked 
      THEN 'running'
    WHEN NOT pl.is_enabled 
      THEN 'disabled'
    WHEN pr.status = 'failed' 
      THEN 'failed'
    WHEN pr.status = 'partial_success'
      THEN 'warning'
    ELSE 'healthy'
  END as health_status,
  CASE 
    WHEN pl.is_locked AND pl.last_heartbeat < now() - INTERVAL '30 minutes' THEN 1
    WHEN pr.status = 'failed' THEN 2
    WHEN pr.status = 'partial_success' THEN 3
    WHEN NOT pl.is_enabled THEN 4
    WHEN pl.is_locked THEN 5
    ELSE 6
  END as sort_priority
FROM process_locks pl
LEFT JOIN LATERAL (
  SELECT * FROM process_runs 
  WHERE process_name = pl.process_name 
  ORDER BY started_at DESC 
  LIMIT 1
) pr ON true
ORDER BY sort_priority, pl.process_name;

-- Unresolved errors needing attention
CREATE VIEW v_unresolved_errors AS
SELECT 
  pe.id,
  pr.process_name,
  pe.severity,
  pe.error_code,
  pe.error_message,
  pe.affected_table,
  pe.affected_record_id,
  pe.attempted_data,
  pe.existing_data,
  pe.created_at,
  pr.started_at as run_started_at
FROM process_errors pe
JOIN process_runs pr ON pr.id = pe.process_run_id
WHERE pe.is_resolved = false
ORDER BY 
  CASE pe.severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 ELSE 3 END,
  pe.created_at DESC;

-- Recent process runs summary (last 7 days)
CREATE VIEW v_recent_runs AS
SELECT 
  process_name,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'partial_success') as partial,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
  MAX(started_at) as last_run,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) 
    FILTER (WHERE completed_at IS NOT NULL) as avg_duration_minutes
FROM process_runs
WHERE started_at > now() - INTERVAL '7 days'
GROUP BY process_name
ORDER BY failed DESC, process_name;

-- Dashboard alerts (things that need attention NOW)
CREATE VIEW v_system_alerts AS

-- Stale locks (process might be dead)
SELECT 
  'stale_lock' as alert_type,
  process_name as source,
  'Process lock held for ' || 
    EXTRACT(EPOCH FROM (now() - last_heartbeat))/60 || ' minutes without heartbeat' as message,
  'critical' as severity,
  locked_at as occurred_at
FROM process_locks
WHERE is_locked = true 
  AND last_heartbeat < now() - INTERVAL '30 minutes'

UNION ALL

-- Recent failures
SELECT 
  'process_failed' as alert_type,
  process_name as source,
  COALESCE(summary, 'Process failed') as message,
  'error' as severity,
  started_at as occurred_at
FROM process_runs
WHERE status = 'failed'
  AND started_at > now() - INTERVAL '24 hours'

UNION ALL

-- Unresolved critical errors
SELECT 
  'unresolved_error' as alert_type,
  pr.process_name as source,
  pe.error_message as message,
  pe.severity,
  pe.created_at as occurred_at
FROM process_errors pe
JOIN process_runs pr ON pr.id = pe.process_run_id
WHERE pe.is_resolved = false
  AND pe.severity = 'critical'

ORDER BY 
  CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 ELSE 3 END,
  occurred_at DESC;
```

---

### SECTION B: Core Data Tables

### churches
Multi-tenant root. Everything belongs to a church.

```sql
CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES system_actors(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES system_actors(id)
);
```

---

### people
Core person record. Minimal but complete.

```sql
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  -- Name fields
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  prefix VARCHAR(20),           -- Mr., Mrs., Dr., Rev.
  suffix VARCHAR(20),           -- Jr., Sr., III
  display_name VARCHAR(255),    -- Computed or overridden
  
  -- Core demographics
  birth_date DATE,
  gender VARCHAR(50),           -- Flexible, not enum
  marital_status VARCHAR(50),   -- single, married, divorced, widowed, separated
  
  -- Contact (primary - additional via separate tables)
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  membership_status VARCHAR(50) DEFAULT 'attendee', -- attendee, member, regular, visitor
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT fk_church FOREIGN KEY (church_id) REFERENCES churches(id)
);

CREATE INDEX idx_people_church ON people(church_id);
CREATE INDEX idx_people_name ON people(last_name, first_name);
CREATE INDEX idx_people_email ON people(email);
```

---

### addresses
Shared address records. One address, many people. House number embedded in street_1.

```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  -- Optional friendly label
  label VARCHAR(100),                  -- "The Smith House", "Grandma's Place"
  
  -- Address fields (3 street lines max, house number in street_1)
  street_1 VARCHAR(255) NOT NULL,      -- "123 Main Street" or "Apt 4B, 500 Oak Ave"
  street_2 VARCHAR(255),
  street_3 VARCHAR(255),               -- International flexibility
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',
  
  -- Geographic data
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  county VARCHAR(100),
  school_district VARCHAR(100),        -- "Auburn School District" - useful for kids ministry
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES system_actors(id),
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES system_actors(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES system_actors(id),
  update_reason VARCHAR(255),          -- "Return mail", "Member update", etc.
  
  CONSTRAINT fk_church FOREIGN KEY (church_id) REFERENCES churches(id)
);

CREATE INDEX idx_addresses_church ON addresses(church_id);
CREATE INDEX idx_addresses_postal ON addresses(postal_code);
CREATE INDEX idx_addresses_geo ON addresses(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_addresses_district ON addresses(school_district) WHERE school_district IS NOT NULL;
CREATE INDEX idx_addresses_active ON addresses(church_id) WHERE is_active = true AND is_deleted = false;

-- Apply audit trigger
CREATE TRIGGER audit_addresses
AFTER INSERT OR UPDATE OR DELETE ON addresses
FOR EACH ROW EXECUTE FUNCTION log_data_change();
```

---

### person_addresses
Many-to-many: People to Addresses with type, primary flag, and validity dates.

```sql
CREATE TABLE person_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  
  -- Type and preference
  address_type VARCHAR(50) NOT NULL DEFAULT 'home', 
    -- home, mailing, work, college, emergency, temporary, seasonal
  is_primary BOOLEAN DEFAULT false,
  
  -- Mailing preferences
  do_not_mail BOOLEAN DEFAULT false,          -- "Don't send mail here"
  do_not_combine_mail BOOLEAN DEFAULT false,  -- "Always mail separately from family"
  
  -- Validity period
  start_date DATE,
  end_date DATE,                       -- NULL = current
  is_active BOOLEAN DEFAULT true,
  
  -- Context
  notes TEXT,                          -- "Fall/Spring semesters only", "Summer address"
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES system_actors(id),
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES system_actors(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES system_actors(id),
  update_reason VARCHAR(255),
  
  UNIQUE(person_id, address_id, address_type)
);

CREATE INDEX idx_person_addresses_person ON person_addresses(person_id);
CREATE INDEX idx_person_addresses_address ON person_addresses(address_id);
CREATE INDEX idx_person_addresses_active ON person_addresses(person_id) 
  WHERE is_active = true AND is_deleted = false;
CREATE INDEX idx_person_addresses_primary ON person_addresses(person_id) 
  WHERE is_primary = true AND is_active = true;

-- Apply audit trigger
CREATE TRIGGER audit_person_addresses
AFTER INSERT OR UPDATE OR DELETE ON person_addresses
FOR EACH ROW EXECUTE FUNCTION log_data_change();
```

---

### organizations
External organizations: schools, employers, etc.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  name VARCHAR(255) NOT NULL,
  org_type VARCHAR(50) NOT NULL, -- school_k12, school_college, employer, other
  
  -- Location (helps identify "University of Washington" vs another)
  city VARCHAR(100),
  state VARCHAR(100),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_church ON organizations(church_id);
CREATE INDEX idx_organizations_type ON organizations(org_type);
```

---

### person_affiliations
Person-to-organization relationships (student, employee, etc.)

```sql
CREATE TABLE person_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  affiliation_type VARCHAR(50) NOT NULL, -- student, employee, volunteer, alumni
  role_title VARCHAR(100),               -- "Junior", "Software Engineer", etc.
  
  start_date DATE,
  end_date DATE,                         -- NULL = current
  is_active BOOLEAN DEFAULT true,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_person_affiliations_person ON person_affiliations(person_id);
CREATE INDEX idx_person_affiliations_org ON person_affiliations(organization_id);
CREATE INDEX idx_person_affiliations_active ON person_affiliations(is_active, end_date);
```

---

### resource_types
Physical resources a position requires (hands, feet, mouth, presence).

```sql
CREATE TABLE resource_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  name VARCHAR(50) NOT NULL,      -- hands, feet, mouth, presence
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data (run once per church or as system defaults)
-- INSERT INTO resource_types (church_id, name, description) VALUES
--   (..., 'hands', 'Requires use of hands (instruments, tech controls)'),
--   (..., 'feet', 'Requires mobility or foot pedals'),
--   (..., 'mouth', 'Requires voice (singing, speaking, directing)'),
--   (..., 'presence', 'Requires physical presence at location');
```

---

### locations
Physical spaces for scheduling conflict detection.

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  name VARCHAR(100) NOT NULL,     -- Stage, Lobby, Nursery, Sound Booth
  description TEXT,
  capacity INT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_locations_church ON locations(church_id);
```

---

### ministry_areas
Top-level ministry categories.

```sql
CREATE TABLE ministry_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  name VARCHAR(100) NOT NULL,     -- Worship, Hospitality, Kids Ministry
  description TEXT,
  
  -- Hierarchy (optional)
  parent_id UUID REFERENCES ministry_areas(id),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ministry_areas_church ON ministry_areas(church_id);
CREATE INDEX idx_ministry_areas_parent ON ministry_areas(parent_id);
```

---

### positions
Specific roles within ministry areas, with resource constraints.

```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  ministry_area_id UUID NOT NULL REFERENCES ministry_areas(id),
  
  name VARCHAR(100) NOT NULL,     -- Drums, Guitar, Door Greeter, Nursery Lead
  description TEXT,
  
  -- Location constraint (if position is location-bound)
  location_id UUID REFERENCES locations(id),
  
  -- Scheduling metadata
  min_people INT DEFAULT 1,
  max_people INT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_positions_church ON positions(church_id);
CREATE INDEX idx_positions_ministry ON positions(ministry_area_id);
```

---

### position_resources
What body-part resources does this position require?

```sql
CREATE TABLE position_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  resource_type_id UUID NOT NULL REFERENCES resource_types(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(position_id, resource_type_id)
);

CREATE INDEX idx_position_resources_position ON position_resources(position_id);
```

---

### person_ministry_areas
Volunteer pool: who is interested/approved/active in each ministry area.

```sql
CREATE TABLE person_ministry_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  ministry_area_id UUID NOT NULL REFERENCES ministry_areas(id) ON DELETE CASCADE,
  
  -- Status progression
  status VARCHAR(50) NOT NULL DEFAULT 'interested', 
    -- interested, pending_approval, approved, active, on_break, inactive
  
  -- Approval tracking
  approved_by UUID REFERENCES people(id),
  approved_date DATE,
  
  -- Specific positions they can fill (optional - can be NULL for "any in this area")
  position_ids UUID[],           -- Array of position IDs they're qualified for
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(person_id, ministry_area_id)
);

CREATE INDEX idx_person_ministry_person ON person_ministry_areas(person_id);
CREATE INDEX idx_person_ministry_area ON person_ministry_areas(ministry_area_id);
CREATE INDEX idx_person_ministry_status ON person_ministry_areas(status);
```

---

### requirements
Church-defined prerequisites for leadership/service.

```sql
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  name VARCHAR(100) NOT NULL,     -- "My Heart Christ's Home", "5-Step Prayer Model"
  description TEXT,
  
  -- Does this expire?
  expires_after_months INT,       -- NULL = never expires
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_requirements_church ON requirements(church_id);
```

---

### person_requirements
Who has completed which requirements.

```sql
CREATE TABLE person_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  
  completed_date DATE NOT NULL,
  verified_by UUID REFERENCES people(id),
  
  -- Computed expiration (if requirement has expires_after_months)
  expires_date DATE,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(person_id, requirement_id)
);

CREATE INDEX idx_person_requirements_person ON person_requirements(person_id);
CREATE INDEX idx_person_requirements_expires ON person_requirements(expires_date);
```

---

### person_clearances
Background checks, driver certifications, child safety training.

```sql
CREATE TABLE person_clearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id),
  
  clearance_type VARCHAR(50) NOT NULL, -- background_check, driver_certified, child_safety
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, denied, expired
  
  issued_date DATE,
  expiration_date DATE,
  
  -- Reference info
  reference_number VARCHAR(100),
  issuing_authority VARCHAR(255),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_person_clearances_person ON person_clearances(person_id);
CREATE INDEX idx_person_clearances_type ON person_clearances(clearance_type);
CREATE INDEX idx_person_clearances_expires ON person_clearances(expiration_date);
```

---

### schedule_requests
Requests sent to volunteers with response tracking.

```sql
CREATE TABLE schedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  -- Who and what
  person_id UUID NOT NULL REFERENCES people(id),
  position_id UUID NOT NULL REFERENCES positions(id),
  
  -- When
  service_date DATE NOT NULL,
  time_block VARCHAR(50),         -- pre_service, worship_set, post_sermon, full_service
  
  -- Request tracking
  requested_at TIMESTAMPTZ DEFAULT now(),
  requested_by UUID REFERENCES people(id),
  
  -- Response
  response VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined, no_response
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,            -- Optional: "out of town", "conflict"
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_schedule_requests_person ON schedule_requests(person_id);
CREATE INDEX idx_schedule_requests_date ON schedule_requests(service_date);
CREATE INDEX idx_schedule_requests_response ON schedule_requests(response);

-- For pattern detection: recent declines by person
CREATE INDEX idx_schedule_requests_person_response 
  ON schedule_requests(person_id, response, service_date DESC);
```

---

### care_notes
Private pastoral intelligence. Awareness, not action.

```sql
CREATE TABLE care_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  -- About whom
  person_id UUID NOT NULL REFERENCES people(id),
  
  -- Content
  content TEXT NOT NULL,
  note_type VARCHAR(50) DEFAULT 'general', -- life_event, prayer, concern, encouragement, general
  
  -- Visibility
  visibility VARCHAR(50) NOT NULL DEFAULT 'pastoral_team', 
    -- pastoral_team, prayer_team, staff, senior_leadership
  is_sensitive BOOLEAN DEFAULT false,  -- Extra restricted (addiction, marriage issues)
  
  -- Lifecycle
  expires_at TIMESTAMPTZ,         -- Some context is temporary
  
  -- Tracking
  created_by UUID NOT NULL REFERENCES people(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_care_notes_person ON care_notes(person_id);
CREATE INDEX idx_care_notes_visibility ON care_notes(visibility);
CREATE INDEX idx_care_notes_created ON care_notes(created_at DESC);
```

---

### care_requests
Actionable followups with assignment and workflow.

```sql
CREATE TABLE care_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  -- About whom (nullable for general requests)
  person_id UUID REFERENCES people(id),
  
  -- What
  request_type VARCHAR(50) NOT NULL, -- connect, followup, visit, call, prayer, meal, other
  content TEXT NOT NULL,
  
  -- Urgency
  urgency VARCHAR(50) DEFAULT 'normal', -- normal, urgent, critical
  notify_immediately BOOLEAN DEFAULT false,
  
  -- Assignment
  assigned_to UUID REFERENCES people(id),
  assigned_team VARCHAR(100),      -- "Men's Ministry", "Care Team"
  due_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES people(id),
  outcome_notes TEXT,
  
  -- Source (was this converted from a care_note?)
  source_care_note_id UUID REFERENCES care_notes(id),
  
  -- Tracking
  created_by UUID NOT NULL REFERENCES people(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_care_requests_person ON care_requests(person_id);
CREATE INDEX idx_care_requests_assigned ON care_requests(assigned_to);
CREATE INDEX idx_care_requests_status ON care_requests(status);
CREATE INDEX idx_care_requests_due ON care_requests(due_date);
CREATE INDEX idx_care_requests_urgency ON care_requests(urgency);
```

---

### person_notification_preferences
How does each person want to receive different types of notifications?

```sql
CREATE TABLE person_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  
  -- What category
  category VARCHAR(50) NOT NULL, 
    -- prayer_requests, schedule_requests, care_followups, announcements, urgent_alerts
  
  -- How
  channel VARCHAR(50) NOT NULL,   -- email, sms, push, in_app
  frequency VARCHAR(50) NOT NULL DEFAULT 'immediate', 
    -- immediate, daily_digest, weekly_digest, none
  
  -- Quiet hours
  quiet_hours_start TIME,         -- Don't notify between these hours (except critical)
  quiet_hours_end TIME,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(person_id, category, channel)
);

CREATE INDEX idx_notification_prefs_person ON person_notification_preferences(person_id);
```

---

## Queries for Common Scenarios

### "Who lives near Janie?" (Crisis proximity)
```sql
SELECT p.display_name, a.street_1, a.city,
       -- Rough distance calculation (Haversine would be better)
       ABS(a.latitude - janie_lat) + ABS(a.longitude - janie_long) as rough_distance
FROM people p
JOIN person_addresses pa ON pa.person_id = p.id AND pa.is_active = true
JOIN addresses a ON a.id = pa.address_id
WHERE a.postal_code = '98092'  -- Or use lat/long radius
  AND p.id != janie_id
ORDER BY rough_distance;
```

### "Is Bob qualified to lead worship?"
```sql
SELECT 
  r.name as requirement,
  pr.completed_date,
  CASE WHEN pr.id IS NOT NULL THEN '✓' ELSE '✗' END as completed
FROM requirements r
LEFT JOIN person_requirements pr ON pr.requirement_id = r.id AND pr.person_id = bob_id
WHERE r.church_id = church_id
  AND r.is_active = true;
```

### "Show me people breaking their volunteer pattern" (Soul care)
```sql
WITH person_baseline AS (
  SELECT person_id,
         COUNT(*) FILTER (WHERE response = 'accepted') as accepts_90d,
         COUNT(*) FILTER (WHERE response = 'declined') as declines_90d
  FROM schedule_requests
  WHERE service_date > CURRENT_DATE - INTERVAL '90 days'
  GROUP BY person_id
),
recent_pattern AS (
  SELECT person_id,
         COUNT(*) FILTER (WHERE response = 'declined') as recent_declines
  FROM schedule_requests
  WHERE service_date > CURRENT_DATE - INTERVAL '21 days'
  GROUP BY person_id
)
SELECT p.display_name, 
       pb.accepts_90d, pb.declines_90d,
       rp.recent_declines as declines_last_3_weeks
FROM recent_pattern rp
JOIN person_baseline pb ON pb.person_id = rp.person_id
JOIN people p ON p.id = rp.person_id
WHERE rp.recent_declines >= 3
  AND pb.declines_90d <= 3  -- Was reliable, now declining
ORDER BY rp.recent_declines DESC;
```

### "Can Sarah serve as Greeter AND Sound Tech at 9am?" (Conflict check)
```sql
-- Check if positions conflict on resources or location
WITH greeter_resources AS (
  SELECT resource_type_id FROM position_resources WHERE position_id = greeter_id
),
sound_tech_resources AS (
  SELECT resource_type_id FROM position_resources WHERE position_id = sound_tech_id
)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM greeter_resources gr 
                 JOIN sound_tech_resources sr ON gr.resource_type_id = sr.resource_type_id)
    THEN 'CONFLICT: Same body resource required'
    WHEN (SELECT location_id FROM positions WHERE id = greeter_id) 
         != (SELECT location_id FROM positions WHERE id = sound_tech_id)
    THEN 'CONFLICT: Different locations'
    ELSE 'OK: No conflict'
  END as scheduling_status;
```

---

## Migration Order (Incremental Build)

### Phase 0: System Infrastructure (First!)
1. `system_actors` — Who/what can make changes
2. `data_change_log` — Universal audit trail
3. `log_data_change()` function — Reusable trigger
4. `process_locks` — Job locking
5. `process_runs` — Process execution tracking
6. `process_steps` — Step-level detail
7. `process_errors` — Error logging
8. System health views

### Phase 1: Foundation
9. `churches` (if not exists)
10. `people` (extend existing)
11. `addresses`
12. `person_addresses`

### Phase 2: Ministry Structure
13. `resource_types`
14. `locations`
15. `ministry_areas`
16. `positions`
17. `position_resources`
18. `person_ministry_areas`

### Phase 3: Scheduling
19. `schedule_requests`

### Phase 4: Requirements & Clearances
20. `requirements`
21. `person_requirements`
22. `person_clearances`

### Phase 5: Pastoral Care
23. `care_notes`
24. `care_requests`

### Phase 6: Notifications
25. `person_notification_preferences`

### Phase 7: Organizations (When Needed)
26. `organizations`
27. `person_affiliations`

---

## System Health Dashboard

### Overview

The System Health page gives administrators instant visibility into:
- Integration status (running, healthy, failed)
- Unresolved errors needing attention
- Recent run history
- Alerts that need immediate action

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM HEALTH                                    Last refresh: │
│                                                   2 min ago [↻] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ALERTS (2)                                              [View] │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔴 CRITICAL: Planning Center Sync lock stale (45 min)   │   │
│  │ 🟡 WARNING: Mailchimp Sync had 3 failures yesterday     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INTEGRATION STATUS                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Planning Center Sync   🟡 Stale    Lock held 45 min     │   │
│  │ Mailchimp Sync         🟢 Healthy  Last run: 2h ago ✓   │   │
│  │ CCLI Export            🟢 Healthy  Last run: 6h ago ✓   │   │
│  │ Nightly Backup         🟢 Healthy  Last run: 8h ago ✓   │   │
│  │ PCO Attendance Import  ⚫ Disabled Paused by admin      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UNRESOLVED ERRORS (7)                               [View All] │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ PC Sync │ DUPLICATE_KEY │ joe@email.com exists │ 2h ago │   │
│  │ PC Sync │ VALIDATION    │ Invalid phone format │ 2h ago │   │
│  │ Mailchi │ API_ERROR     │ Rate limit exceeded  │ 1d ago │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAST 7 DAYS                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Process              │ Runs │  ✓  │  ⚠  │  ✗  │ Avg    │   │
│  │ Planning Center Sync │  168 │ 165 │   2 │   1 │ 4.2m   │   │
│  │ Mailchimp Sync       │   14 │  12 │   1 │   1 │ 2.1m   │   │
│  │ CCLI Export          │    2 │   2 │   0 │   0 │ 0.5m   │   │
│  │ Nightly Backup       │    7 │   7 │   0 │   0 │ 12.3m  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Status Icons

| Icon | Status | Meaning |
|------|--------|---------|
| 🟢 | Healthy | Last run succeeded, no issues |
| 🟡 | Warning | Partial success, or lock possibly stale |
| 🔴 | Failed | Last run failed, or critical errors |
| 🔵 | Running | Currently executing |
| ⚫ | Disabled | Manually paused |

### Key Interactions

**Click on integration row:**
- View run history
- See last 10 runs with status
- Drill into specific run's steps and errors

**Click on error:**
- See full error details
- View attempted vs existing data
- Mark as resolved with notes
- Jump to affected record

**Actions:**
- [Force Run] — Manually trigger an integration
- [Disable/Enable] — Pause or resume a job
- [Release Lock] — Force-release a stale lock (with confirmation)

### Notification Settings

Per-integration alerting configuration:

```sql
CREATE TABLE process_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_name VARCHAR(100) NOT NULL REFERENCES process_locks(process_name),
  
  -- Who to notify
  notify_actor_id UUID REFERENCES system_actors(id),  -- Person or team
  
  -- When to notify
  on_failure BOOLEAN DEFAULT true,
  on_partial_success BOOLEAN DEFAULT false,
  on_stale_lock BOOLEAN DEFAULT true,
  on_success BOOLEAN DEFAULT false,                   -- Usually too noisy
  
  -- How to notify
  channel VARCHAR(50) DEFAULT 'email',                -- email, sms, in_app
  
  -- Throttling
  min_minutes_between_alerts INT DEFAULT 60,          -- Don't spam
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Notes for Future Consideration

### Not Yet Designed (Intentionally Deferred)
- **Services / Events** — Exists in current schema, will integrate
- **Songs / Setlists** — Exists in current schema, will integrate
- **CCLI/CVLI Reporting** — Future phase
- **Multi-site / Campus** — Architecture supports it, UI deferred
- **Living Room / Internal Communications** — Future phase
- **Workflow Engine** — Future phase (auto-assign tasks, reminders)

### Resolved Questions
- ✅ Address fields: 3 street lines max, house number embedded in street_1
- ✅ School tracking: `school_district` on address, specific school via `person_affiliations`
- ✅ Families vs households: Families are relational units; households are implicit (query "who shares this address")
- ✅ Audit trail: Full `data_change_log` table with triggers for point-in-time recovery
- ✅ Error logging: Separate `process_errors` table with resolution tracking
- ✅ Job locking: `process_locks` table prevents overlapping runs

### Open Questions
- **Mailing merge logic**: When generating mail, how do we determine "combine into one envelope"? Family-level flag? Household detection? User choice at export time?
- **History retention**: How long to keep `data_change_log` records? Forever? 7 years? Configurable per church?
- **Restore permissions**: Who can perform point-in-time restores? Admin only? Need a specific role?
- **Integration heartbeat interval**: How often should long-running jobs ping `last_heartbeat`? Every 5 min? Every step?
- **Geocoding service**: Which service for lat/long lookup? Google Maps API? OpenStreetMap/Nominatim? Cost considerations.

---

*This document is a living reference. Build incrementally. Stay true to the principles.*
*"The system doesn't lie."*
