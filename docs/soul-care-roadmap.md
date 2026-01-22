// /docs/soul-care-roadmap.md
# WORSHIPOS SOUL CARE & SHEPHERDING FEATURES
# Moving from Logistics to People Stewardship
# =====================================================

## PHILOSOPHY
The goal is not just to fill slots, but to care for people. Every feature should answer:
"How does this help us shepherd volunteers better?"

## FEATURE 1: LIVE AUDIBLE (Maximum Flexibility)
### The Problem
Worship is dynamic. The Spirit moves. Plans change mid-service. Current systems force rigidity.

### The Solution: Live Service Mode
**Real-Time Sync Requirements:**
- WebSockets for instant updates across all connected devices
- Lock/Unlock mechanism so only MD/Leader can make changes
- Visual indicator showing who's in "control mode"

**Core Features:**
1. **Live Reordering**
   - Drag-and-drop reorders setlist
   - Changes propagate to all devices < 500ms
   - Visual "ghost" preview before confirming major changes

2. **Emergency Search Bar**
   - Always visible floating search in Live Mode
   - Type song name → instant search
   - Click "Add" → drops at current position
   - Option to add "after current" or "next up"

3. **Skip Button**
   - Big, obvious button next to current item
   - One tap = grays out for everyone
   - Optional reason: "Going long", "Spirit led", "Technical issue"
   - Preserves in history for post-service review

4. **Current Position Sync**
   - All devices show current song highlighted
   - "Up Next" preview for lyric operator
   - Sound tech sees upcoming instrumentation needs

**Technical Implementation:**
- WebSocket connection using Socket.io
- Redux/Svelte store for state management
- Optimistic updates with rollback on conflict
- Offline mode with queue-and-sync when reconnected

**Database Schema Additions:**
```sql
-- Track live service state
CREATE TABLE live_service_sessions (
  id uuid PRIMARY KEY,
  service_instance_id uuid REFERENCES service_instances(id),
  started_at timestamptz,
  ended_at timestamptz,
  controlled_by uuid REFERENCES people(id), -- Who has control
  is_active boolean
);

-- Track setlist changes during service
CREATE TABLE live_setlist_changes (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES live_service_sessions(id),
  song_id uuid,
  action text, -- 'added', 'removed', 'reordered', 'skipped'
  reason text,
  changed_by uuid REFERENCES people(id),
  changed_at timestamptz,
  old_position int,
  new_position int
);
```

---

## FEATURE 2: MARATHON RUNNER ALERT (Burnout Prevention)
### The Problem
Reliable volunteers get over-scheduled. Burnout leads to dropout.

### Logic Rules
**Trigger Conditions:**
1. **Consecutive Weeks Alert (Yellow Warning)**
   - Served 4+ consecutive weeks → Yellow alert
   - Message: "⚠️ Bob has served 4 weeks straight. Consider a break?"

2. **High Frequency Alert (Orange Warning)**
   - Served 6+ times in last 8 weeks → Orange alert
   - Message: "🧡 Bob is at 75% capacity (6 of 8 weeks). Schedule carefully."

3. **Critical Burnout Risk (Red Alert)**
   - Served 7+ times in last 8 weeks OR 6+ consecutive weeks
   - Message: "🔴 BURNOUT RISK: Bob has served 6 weeks in a row. Please give him rest."
   - Blocks scheduling unless override with reason

**Frequency Thresholds by Role:**
Some roles are more taxing than others.

```javascript
const ROLE_WEIGHTS = {
  'Worship Leader': 1.5,      // Leading is exhausting
  'Sound Tech': 1.3,          // High focus required
  'Video Producer': 1.3,
  'Kids Check-in': 1.2,       // High responsibility
  'BaseCamp': 1.0,            // Standard
  'Greeter': 0.7,             // Lower intensity
  'Prayer Team': 0.8
};

// Calculate "load score" instead of raw count
// Example: 4 weeks as Worship Leader = 6.0 load score
// Same 4 weeks as Greeter = 2.8 load score
```

**Smart Scheduling Suggestions:**
When alert triggers, show:
- "Last served: Dec 7, 2025"
- "Total serves last 8 weeks: 6"
- "Suggested next serve: Jan 4, 2026 (2 weeks rest)"
- "Alternative volunteers available: Jeff, Jimmy John, Shelby"

**Override Process:**
1. Alert appears when trying to schedule Bob
2. Must click "I understand, schedule anyway"
3. Optional reason field: "Bob specifically requested this week"
4. Logs override with timestamp and reason
5. Alerts coordinator in 2 weeks if pattern continues

**Database Schema:**
```sql
-- Track volunteer service frequency
CREATE TABLE volunteer_health_metrics (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES orgs(id),
  person_id uuid REFERENCES people(id),
  calculated_at timestamptz,
  
  -- Metrics
  consecutive_weeks int,
  serves_last_4_weeks int,
  serves_last_8_weeks int,
  weighted_load_score decimal,
  days_since_last_serve int,
  
  -- Alert status
  burnout_risk_level text, -- 'green', 'yellow', 'orange', 'red'
  needs_attention boolean,
  
  UNIQUE(org_id, person_id, calculated_at)
);

-- Track scheduling overrides
CREATE TABLE scheduling_overrides (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES orgs(id),
  service_assignment_id uuid REFERENCES service_assignments(id),
  override_type text, -- 'burnout_warning', 'unavailable', 'conflict'
  reason text,
  overridden_by uuid REFERENCES people(id),
  overridden_at timestamptz
);
```

---

## FEATURE 3: GHOST PROTOCOL (Retention & Care)
### The Problem
Volunteers drift away silently. No one notices until it's too late.

### Logic Rules
**Detection Triggers:**

1. **Decline Streak (Yellow Flag)**
   - 2 consecutive declines → Soft flag
   - 3 consecutive declines → "Needs Check-In" list
   - 4+ consecutive declines → "At Risk" list

2. **Absence Pattern (Orange Flag)**
   - Last served > 6 weeks ago AND was previously regular (2+/month)
   - Message: "Sue hasn't served in 6 weeks. Was serving 2x/month before."

3. **Complete Ghosting (Red Flag)**
   - Last served > 12 weeks AND no logged contact
   - OR: 5+ consecutive declines with no check-in logged
   - Message: "Sue has been inactive 3 months. No contact logged."

**The "Needs Follow-Up" Dashboard Widget:**
```
┌─────────────────────────────────────────────┐
│ NEEDS FOLLOW-UP                        [5]  │
├─────────────────────────────────────────────┤
│ 🔴 Sue Martinez                              │
│    • 3 consecutive declines                  │
│    • Last served: 6 weeks ago                │
│    [Log Check-In] [Snooze 30 Days]          │
├─────────────────────────────────────────────┤
│ 🟡 Mike Thompson                             │
│    • Hasn't served in 8 weeks                │
│    • Was serving 2x/month                    │
│    [Log Check-In] [Mark Inactive]           │
└─────────────────────────────────────────────┘
```

**Check-In Logging:**
When you click "Log Check-In":
1. Modal opens with:
   - Date (pre-filled with today)
   - Contact method: Call, Text, Email, In-Person
   - Notes: Free text
   - Outcome: "All Good", "Taking Break", "Life Season", "Burnout", "Conflict", "Left Church"
   - Next action: "Follow up in X weeks", "Remove from rotation", "No action needed"

2. Privacy: Sue never sees this. It's pastoral care documentation.

3. Alert snooze: System won't re-alert based on your "Next action" date

**Proactive Outreach:**
Generate suggested messages:
```
Template for 3 declines:
"Hi Sue! We've missed you on the team. Everything okay? 
Just wanted to check in - no pressure, just care. ❤️"

Template for 8 weeks absence:
"Sue, it's been a couple months since we've seen you serve. 
Life gets busy! Want to grab coffee and catch up?"
```

**Database Schema:**
```sql
-- Track volunteer engagement patterns
CREATE TABLE volunteer_engagement_tracking (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES orgs(id),
  person_id uuid REFERENCES people(id),
  
  -- Decline tracking
  consecutive_declines int DEFAULT 0,
  total_declines_last_90_days int,
  last_decline_date date,
  
  -- Absence tracking
  last_served_date date,
  days_since_last_serve int,
  previous_serve_frequency decimal, -- serves per month before absence
  
  -- Engagement status
  status text, -- 'active', 'at_risk', 'ghosting', 'inactive'
  needs_followup boolean,
  
  -- Care tracking
  last_contact_date date,
  last_contact_method text,
  last_contact_outcome text,
  next_followup_date date,
  
  updated_at timestamptz
);

-- Log pastoral check-ins
CREATE TABLE pastoral_checkins (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES orgs(id),
  person_id uuid REFERENCES people(id),
  contacted_by uuid REFERENCES people(id),
  contacted_at timestamptz,
  
  contact_method text, -- 'call', 'text', 'email', 'in_person'
  outcome text, -- 'all_good', 'taking_break', 'life_season', 'burnout', 'conflict', 'left_church'
  notes text,
  next_action text,
  followup_date date,
  
  is_private boolean DEFAULT true -- Only visible to coordinators
);
```

---

## HEALTH CHECK DASHBOARD (Main View)
### The Coordinator's Mission Control

**Top Section: At-a-Glance Health**
```
┌──────────────────────────────────────────────────────────┐
│  TEAM HEALTH                                              │
├──────────────────────────────────────────────────────────┤
│  🟢 Healthy: 42 volunteers                                │
│     Serving regularly, no concerns                        │
│                                                            │
│  🟡 At Risk (Over-Serving): 3 volunteers                  │
│     → Bob (6 consecutive weeks)                           │
│     → Mike (7 of last 8 weeks)                            │
│     [View Details] [Schedule Break]                       │
│                                                            │
│  🔴 Disconnected: 5 volunteers                            │
│     → Sue (3 declines, 6 weeks absent)                    │
│     → Jen (No contact, 12 weeks absent)                   │
│     [Follow Up] [View List]                               │
└──────────────────────────────────────────────────────────┘
```

**Middle Section: Upcoming Services**
Shows next 4 weeks with staffing status + care alerts mixed in

**Bottom Section: Action Items**
- "3 volunteers need follow-up calls"
- "2 volunteers should rest next week"
- "Dec 25 service: 4 positions unfilled"

---

## IMPLEMENTATION PRIORITIES
### Phase 1: Foundation (Current Focus)
- ✅ Basic scheduling
- ✅ Service instances
- ✅ Role requirements
- 🔄 Assignment tracking
- 🔄 Person/family management

### Phase 2: Metrics & Alerts (Next 2-3 Months)
- Calculate serve frequency
- Track consecutive weeks
- Decline tracking
- Basic burnout alerts
- Simple "Needs Follow-Up" list

### Phase 3: Proactive Care (3-6 Months)
- Pastoral check-in logging
- Smart scheduling suggestions
- Alternative volunteer recommendations
- Automated care reminders

### Phase 4: Live Service Mode (6-12 Months)
- WebSocket infrastructure
- Real-time setlist management
- Multi-device sync
- Live mode UI

---

## SPECIFIC LOGIC RULES (FINAL RECOMMENDATION)

### Burnout Warning Thresholds:
```javascript
const BURNOUT_RULES = {
  yellow: {
    consecutive_weeks: 4,
    serves_in_8_weeks: 5,
    message: "Consider a break"
  },
  orange: {
    consecutive_weeks: 5,
    serves_in_8_weeks: 6,
    message: "High frequency - schedule carefully"
  },
  red: {
    consecutive_weeks: 6,
    serves_in_8_weeks: 7,
    message: "BURNOUT RISK - Give rest",
    require_override: true
  }
};
```

### Engagement Alert Thresholds:
```javascript
const ENGAGEMENT_RULES = {
  decline_streak: {
    yellow: 2,  // Soft flag
    orange: 3,  // Needs check-in
    red: 4      // At risk
  },
  absence_days: {
    yellow: 42,   // 6 weeks for regular volunteers
    orange: 56,   // 8 weeks
    red: 84       // 12 weeks
  },
  requires_contact: {
    no_contact_days: 90,  // Must log contact every 90 days for inactive
    decline_threshold: 3   // Must contact after 3 declines
  }
};
```

---

## NEXT STEPS
1. Build `volunteer_health_metrics` calculation job (runs nightly)
2. Create basic alert UI in scheduling screen
3. Add "Needs Follow-Up" widget to dashboard
4. Build pastoral check-in logging system

**Would you like me to start building the metrics calculation system first, or the check-in logging UI?**
