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

### churches
Multi-tenant root. Everything belongs to a church.

```sql
CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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
Shared address records. One address, many people.

```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  
  -- Optional friendly label
  label VARCHAR(100),           -- "The Smith House", "Grandma's Place"
  
  -- Address fields
  street_1 VARCHAR(255) NOT NULL,
  street_2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',
  
  -- Geocoding (for proximity queries)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_addresses_church ON addresses(church_id);
CREATE INDEX idx_addresses_postal ON addresses(postal_code);
CREATE INDEX idx_addresses_geo ON addresses(latitude, longitude);
```

---

### person_addresses
Many-to-many: People to Addresses with type and primary flag.

```sql
CREATE TABLE person_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  
  -- Type and status
  address_type VARCHAR(50) NOT NULL DEFAULT 'home', -- home, work, college, mailing, temporary
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Context
  notes TEXT,                   -- "Fall/Spring semesters only"
  start_date DATE,
  end_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(person_id, address_id, address_type)
);

CREATE INDEX idx_person_addresses_person ON person_addresses(person_id);
CREATE INDEX idx_person_addresses_address ON person_addresses(address_id);
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

### Phase 1: Foundation (Now)
1. `churches` (if not exists)
2. `people` (extend existing)
3. `addresses`
4. `person_addresses`

### Phase 2: Ministry Structure
5. `resource_types`
6. `locations`
7. `ministry_areas`
8. `positions`
9. `position_resources`
10. `person_ministry_areas`

### Phase 3: Scheduling
11. `schedule_requests`

### Phase 4: Requirements & Clearances
12. `requirements`
13. `person_requirements`
14. `person_clearances`

### Phase 5: Pastoral Care
15. `care_notes`
16. `care_requests`

### Phase 6: Notifications
17. `person_notification_preferences`

### Phase 7: Organizations (When Needed)
18. `organizations`
19. `person_affiliations`

---

## Notes for Future Consideration

### Not Yet Designed (Intentionally Deferred)
- **Services / Events** — Exists in current schema, will integrate
- **Songs / Setlists** — Exists in current schema, will integrate
- **CCLI/CVLI Reporting** — Future phase
- **Multi-site / Campus** — Architecture supports it, UI deferred
- **Living Room / Internal Communications** — Future phase
- **Workflow Engine** — Future phase (auto-assign tasks, reminders)

### Open Questions
- Do we need `person_phones` and `person_emails` as separate tables for multiple contact methods?
- Should `care_requests` have a "convert to care_note" when resolved (preserve history)?
- Do we need `schedule_assignments` separate from `schedule_requests` (confirmed vs requested)?

---

*This document is a living reference. Build incrementally. Stay true to the principles.*
