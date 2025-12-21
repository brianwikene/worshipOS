# WORSHIPOS: RUN SHEETS, TEMPLATES & ROLE-BASED VIEWS
# Advanced Scheduling Concepts
# =====================================================

## PROBLEM STATEMENT
Current church scheduling tools treat a service as one big block. Reality is more nuanced:
- Services have distinct segments/moments
- People can serve in multiple non-conflicting roles
- Different team members need different views of the same data
- Good patterns should be reusable (templates)

---

## CONCEPT 1: RUN SHEET SCHEDULING (Time Segments)
### The Reality
A Sunday service isn't "10 AM - 12 PM worship team."
It's a sequence of segments with different people active at different times.

### Example Run Sheet:
```
9:45 AM  | Pre-Service Prayer      | Prayer Team (5 people)
10:00 AM | Worship Set (Pre)       | Full Band + Vocals
10:25 AM | Welcome / Announcements | Pastor, Slides Operator
10:30 AM | Offering / Testimony    | Worship Leader
10:35 AM | Sermon                  | Pastor, Slides Operator
11:05 AM | Worship Set (Response)  | Acoustic + Vocals only
11:15 AM | Dismissal               | Pastor
```

### Key Insight: Conflict Groups
**GROUP A - Worship Team** (Can't do C)
- Worship Leader
- Instruments
- Background Vocals

**GROUP B - Hospitality** (Can do some of A, not C)
- Greeters (before service, can do A after greeting)
- Coffee/Hospitality (before service)
- Prayer Team (overlaps with A during worship)

**GROUP C - Kids/Youth Ministry** (Can't do A or B during service)
- Nursery
- Toddlers
- BaseCamp
- Youth Leader
- Kids Check-in

### Stacking Rules (Body Part Logic)
Some roles can stack within the same time slot:

**Hands/Feet:**
- ✅ Guitar + Vocals (different body parts)
- ✅ Bass + Vocals
- ❌ Drums + Keys (both need hands/feet)

**Example: Bob's Multi-Role Service**
```
9:30 AM  | Greeter (Doors)         | Bob (GROUP B)
10:00 AM | Worship (Pre-Sermon)    | Bob on Bass (GROUP A)
10:30 AM | [Break - Bob sits]      | 
11:05 AM | Worship (Post-Sermon)   | Bob on Acoustic + Vocals (GROUP A)
```

**Database Schema:**
```sql
-- Define service segments (the run sheet)
CREATE TABLE service_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  service_instance_id uuid NOT NULL REFERENCES service_instances(id),
  
  -- Segment details
  name text NOT NULL, -- "Pre-Service Worship", "Sermon", "Response"
  segment_type text, -- 'worship', 'teaching', 'prayer', 'transition', 'other'
  start_time time,
  duration_minutes int,
  display_order int NOT NULL,
  
  -- Conflict tracking
  conflict_group text, -- 'worship_team', 'hospitality', 'kids_ministry'
  
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Assignments are now per-segment, not per-service
CREATE TABLE segment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  segment_id uuid NOT NULL REFERENCES service_segments(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  person_id uuid REFERENCES people(id),
  
  -- Role stacking info
  body_parts_used text[], -- ['hands', 'feet', 'voice']
  can_stack boolean DEFAULT false,
  
  status text DEFAULT 'pending',
  is_lead boolean DEFAULT false,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_segment_role_person UNIQUE(segment_id, role_id, person_id)
);

-- Conflict detection view
CREATE OR REPLACE VIEW v_person_segment_conflicts AS
SELECT 
  sa1.person_id,
  sa1.segment_id as segment1_id,
  sa2.segment_id as segment2_id,
  s1.name as segment1_name,
  s2.name as segment2_name,
  s1.conflict_group as group1,
  s2.conflict_group as group2,
  CASE 
    WHEN s1.conflict_group = s2.conflict_group 
      AND s1.start_time < s2.start_time + (s2.duration_minutes || ' minutes')::interval
      AND s2.start_time < s1.start_time + (s1.duration_minutes || ' minutes')::interval
    THEN true
    ELSE false
  END as has_conflict
FROM segment_assignments sa1
JOIN segment_assignments sa2 ON sa1.person_id = sa2.person_id 
  AND sa1.segment_id != sa2.segment_id
JOIN service_segments s1 ON s1.id = sa1.segment_id
JOIN service_segments s2 ON s2.id = sa2.segment_id
WHERE sa1.person_id IS NOT NULL
  AND sa2.person_id IS NOT NULL;
```

---

## CONCEPT 2: SERVICE TEMPLATES ("The Groove")
### The Problem
You don't want to rebuild the same service structure every week.

### The Solution: Templates
**Standard Sunday Template:**
```
Segment 1: Pre-Service (9:45)   - Prayer Team
Segment 2: Worship Set 1 (10:00) - Full Band (Drums, Bass, 2 Guitars, Keys, 2 Vocals)
Segment 3: Welcome (10:25)       - Pastor, Slides
Segment 4: Offering (10:30)      - Worship Leader (Acoustic only)
Segment 5: Sermon (10:35)        - Pastor, Slides
Segment 6: Response Worship (11:05) - Acoustic + Piano + Vocals
Segment 7: Dismissal (11:15)     - Pastor
```

**Special Event Template (Baptism Sunday):**
```
[All Standard Sunday segments]
+ Segment 5b: Baptism Testimonies (10:50) - Pastor, Video Tech
+ Segment 5c: Baptisms (11:00)            - Pastor, Baptism Team
[Then continues with Response Worship]
```

### Workflow:

**Creating a Service from Template:**
1. User clicks "Add Service" for Dec 21
2. Prompt: "Which template?" 
   - Standard Sunday
   - Baptism Sunday
   - Christmas Service
   - [Custom]
3. Backend copies template → creates segments for Dec 21
4. User can now customize this specific service without affecting template

**Saving a Custom Service as Template:**
1. User tweaked Dec 14 service (added extra worship segment, moved things around)
2. Click "Save as Template"
3. Name it: "Extended Worship Sunday"
4. Future services can now use this pattern

**Database Schema:**
```sql
-- Service templates (the "grooves")
CREATE TABLE service_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  name text NOT NULL, -- "Standard Sunday", "Baptism Service"
  description text,
  context_id uuid REFERENCES contexts(id), -- Which service type uses this
  
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false, -- Default template for this context
  
  created_by uuid REFERENCES people(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Template segments (the structure)
CREATE TABLE template_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES service_templates(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  segment_type text,
  relative_start_minutes int, -- Minutes from service start
  duration_minutes int,
  display_order int NOT NULL,
  conflict_group text,
  notes text
);

-- Template role requirements (what roles each segment needs)
CREATE TABLE template_segment_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_segment_id uuid NOT NULL REFERENCES template_segments(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  
  min_needed int DEFAULT 1,
  max_needed int DEFAULT 1,
  is_required boolean DEFAULT true,
  notes text
);

-- Function to instantiate template
CREATE OR REPLACE FUNCTION create_service_from_template(
  p_template_id uuid,
  p_service_instance_id uuid
) RETURNS void AS $$
DECLARE
  v_segment record;
  v_new_segment_id uuid;
  v_role record;
BEGIN
  -- Copy template segments to actual service segments
  FOR v_segment IN 
    SELECT * FROM template_segments 
    WHERE template_id = p_template_id 
    ORDER BY display_order
  LOOP
    INSERT INTO service_segments (
      org_id, service_instance_id, name, segment_type,
      duration_minutes, display_order, conflict_group, notes
    )
    SELECT 
      si.org_id, 
      p_service_instance_id,
      v_segment.name,
      v_segment.segment_type,
      v_segment.duration_minutes,
      v_segment.display_order,
      v_segment.conflict_group,
      v_segment.notes
    FROM service_instances si
    WHERE si.id = p_service_instance_id
    RETURNING id INTO v_new_segment_id;
    
    -- Copy role requirements
    FOR v_role IN
      SELECT * FROM template_segment_roles
      WHERE template_segment_id = v_segment.id
    LOOP
      -- Create placeholder assignments for required roles
      INSERT INTO segment_assignments (
        org_id, segment_id, role_id, person_id, status
      )
      SELECT 
        si.org_id,
        v_new_segment_id,
        v_role.role_id,
        NULL, -- Not assigned yet
        'pending'
      FROM service_instances si
      WHERE si.id = p_service_instance_id;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## CONCEPT 3: ROLE-BASED VIEWS ("The Lens")
### The Problem
Too much information is noise. Each team member needs their specific view.

### The Solution: Filtered Views of Master Data
**One source of truth, many perspectives.**

### View A: Producer/Tech Director (The "Control Freak" View)
**Needs:** Everything. Every detail. Full control.
```
TIME  | SEGMENT              | WHO                | TECH NEEDS           | NOTES
------+----------------------+--------------------+----------------------+-------------------
9:45  | Pre-Service Prayer   | Prayer Team (5)    | Ambient lights       | Soft background music
10:00 | Song: Way Maker      | Brian (Keys, Ldr)  | Vox 1, Keys DI       | Key: G, 72 BPM
      |                      | Jimmy (Acoustic)   | Vox 2, Acoustic DI   |
      |                      | Michelle (BGV)     | Vox 3                |
10:05 | Song: Goodness...    | [Same band]        | [Same mics]          | Key: A, 138 BPM
10:25 | Welcome              | Pastor Mike        | Vox 1 (handheld)     | Announcements slide
10:30 | Sermon               | Pastor Mike        | Vox 1, Confidence    | Romans 8 scripture
11:05 | Song: Great Are You  | Shelby (Vocal Ldr) | Vox 1                | Key: C, 75 BPM
      |                      | Jeff (Electric)    | Vox 2, Electric      | Soft dynamics
```

**API Endpoint:**
```javascript
GET /services/:id/runsheet?view=producer
```

### View B: Lyrics Operator (The "What's Next?" View)
**Needs:** Song order, lyrics maps, slide cues
```
ORDER | ITEM                    | SONG MAP / SLIDES        | NOTES
------+-------------------------+--------------------------+---------------------------
1     | Song: Way Maker         | V1, C, V2, C, B, C, C    | Hold title until downbeat
2     | Song: Goodness of God   | V1, PC, C, V2, PC, C, B  | Fast transition
3     | Welcome                 | Welcome loop slide       | 
4     | Announcements           | Announcement slides (5)  | Auto-advance
5     | Offering                | Offering slide           | 
6     | Sermon                  | Romans 8:1-4             | Pastor will advance
7     | Song: Great Are You     | V1, C, V2, C, B, C       | Spontaneous - follow Shelby
```

**API Endpoint:**
```javascript
GET /services/:id/runsheet?view=lyrics
```

### View C: Band/Musicians (The "Music Chart" View)
**Needs:** Song keys, tempos, who's leading, arrangement notes
```
ITEM              | KEY | BPM | LEADER | ARRANGEMENT          | MY ROLE
------------------+-----+-----+--------+----------------------+------------------
Way Maker         | G   | 72  | Brian  | Full band, build     | Bass (root notes)
Goodness of God   | A   | 138 | Brian  | Energetic, groove    | Bass (walkup intro)
[Sermon Break]    |     |     |        |                      | [Rest - 30 min]
Great Are You     | C   | 75  | Shelby | Acoustic & piano only| [Not needed]
```

**API Endpoint:**
```javascript
GET /services/:id/runsheet?view=musician&person_id=bob
// Returns only segments where Bob is assigned
```

### View D: Kids Ministry (The "When Can Parents Drop Off?" View)
**Needs:** Service schedule with kids ministry timing
```
TIME  | MAIN SERVICE        | KIDS MINISTRY STATUS
------+---------------------+---------------------------
9:45  | Doors Open          | ✅ Check-in opens
10:00 | Worship starts      | ✅ Nursery/BaseCamp open
10:30 | Sermon begins       | ✅ All kids in rooms
11:05 | Worship (response)  | ✅ Kids still in rooms
11:20 | Service ends        | ⚠️  Pick-up begins
```

**API Endpoint:**
```javascript
GET /services/:id/runsheet?view=kids_ministry
```

### Implementation Strategy:

**Backend:**
One master query gets all data. Views are just different filters/projections.

```javascript
// Base query gets everything
const fullRunsheet = await getServiceRunsheet(serviceId);

// Views are just transformations
switch (viewType) {
  case 'producer':
    return fullRunsheet; // Everything
    
  case 'lyrics':
    return fullRunsheet.map(segment => ({
      order: segment.display_order,
      item: segment.name,
      songMap: segment.song?.structure,
      slides: segment.slide_notes,
      notes: segment.lyrics_notes
    }));
    
  case 'musician':
    return fullRunsheet
      .filter(seg => seg.assignments.some(a => a.person_id === personId))
      .map(segment => ({
        item: segment.name,
        key: segment.song?.key,
        bpm: segment.song?.bpm,
        leader: segment.assignments.find(a => a.is_lead)?.person_name,
        myRole: segment.assignments
          .filter(a => a.person_id === personId)
          .map(a => a.role_name)
          .join(', ')
      }));
      
  case 'kids_ministry':
    return fullRunsheet.map(segment => ({
      time: segment.start_time,
      mainService: segment.name,
      kidsStatus: getKidsMinistryStatus(segment)
    }));
}
```

---

## EXAMPLE: DRUMMER MOVES TO PERCUSSION
### The Scenario
Sunday service has two worship segments:
1. **Pre-Sermon (10:00):** Full band, high energy → Mike on Drums
2. **Post-Sermon (11:05):** Reflective, intimate → Mike on Cajón (percussion)

### Database Representation:
```sql
-- Segment 1: Pre-Sermon Worship
INSERT INTO service_segments (service_instance_id, name, start_time, duration_minutes)
VALUES (service_id, 'Worship Set 1', '10:00', 25);

INSERT INTO segment_assignments (segment_id, role_id, person_id)
VALUES 
  (segment1_id, drums_role_id, mike_id),
  (segment1_id, bass_role_id, bob_id);

-- Segment 2: Post-Sermon Worship  
INSERT INTO service_segments (service_instance_id, name, start_time, duration_minutes)
VALUES (service_id, 'Response Worship', '11:05', 15);

INSERT INTO segment_assignments (segment_id, role_id, person_id)
VALUES 
  (segment2_id, percussion_role_id, mike_id),  -- Mike switched to cajón
  (segment2_id, bass_role_id, bob_id);
```

### UI Representation:
```
Mike's Schedule for Dec 21:
┌─────────────────────────────────────┐
│ 10:00 AM - Worship Set 1            │
│ Role: Drums                          │
│ Duration: 25 min                     │
├─────────────────────────────────────┤
│ [30 min break]                       │
├─────────────────────────────────────┤
│ 11:05 AM - Response Worship          │
│ Role: Percussion (Cajón)             │
│ Duration: 15 min                     │
└─────────────────────────────────────┘
```

---

## IMPLEMENTATION PRIORITIES

### Phase 1: Basic Segments (Near Term)
- [ ] Create `service_segments` table
- [ ] Create `segment_assignments` table
- [ ] Basic UI to add/edit segments
- [ ] Simple conflict detection (same person, overlapping times)

### Phase 2: Templates (Medium Term)
- [ ] Create template tables
- [ ] UI to create/edit templates
- [ ] "Create from template" workflow
- [ ] "Save as template" from existing service

### Phase 3: Role-Based Views (Medium Term)
- [ ] API endpoints for filtered views
- [ ] Producer view UI
- [ ] Lyrics operator view UI
- [ ] Musician view UI
- [ ] Printable run sheets

### Phase 4: Advanced Features (Long Term)
- [ ] Conflict group validation
- [ ] Body part stacking rules
- [ ] Drag-and-drop segment reordering
- [ ] Live mode (for real-time updates)

---

## NEXT STEPS
**Question for Brian:** Should we:
1. Build segments into the current scheduling system first?
2. Or get basic templates working so you can reuse patterns?
3. Or focus on getting one role-based view (lyrics operator) working end-to-end?

What would be most immediately useful for your team?
