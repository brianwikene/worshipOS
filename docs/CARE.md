// /docs/CARE.md
# CARE — Case Container

> **Core principle:** CARE responds. It never notices on its own.

## What CARE Is

- A **container** — not a lens
- A **case** — with ownership and follow-up
- A **story** — with responsibility attached
- A **record** — that persists as history

CARE answers: **"What are we doing about this?"**

## What CARE Always Has

Every Care case must have:
- An **owner** or assigned follow-up
- **Access control** (RLS/RBAC)
- Potential for **sensitive material**
- **Persistence** as historical record

## Boundaries

### TEND → CARE (allowed, one-way)

Care cases may be triggered by TEND signals:
- Source tracked: `care_cases.source = 'tend'`
- Signal reference: `care_cases.source_signal_id`
- Only non-sensitive context passed at handoff

After handoff, TEND is not involved.

### CARE → TEND (never direct)

CARE never:
- Updates TEND tables
- Writes to TEND signals
- Uses TEND as a notification layer

Care actions may *indirectly* affect what TEND observes later:
- Schedule change → TEND sees healthier serving pattern
- But CARE doesn't tell TEND this happened

**TEND reads outcomes. CARE writes stories.**

## Schema Constraints

### Required Fields
```sql
care_cases (
  id              uuid primary key,
  person_id       uuid not null,      -- who this is about
  owner_id        uuid not null,      -- who's responsible
  status          text not null,      -- open, in_progress, resolved, closed
  source          text,               -- 'tend', 'manual', 'referral', etc.
  source_signal_id uuid,              -- FK if source = 'tend'
  created_at      timestamptz,
  updated_at      timestamptz
)

care_notes (
  id              uuid primary key,
  case_id         uuid not null,      -- FK to care_cases
  author_id       uuid not null,
  content         text,               -- sensitive, access-controlled
  created_at      timestamptz
)
```

### Access Control

- Notes visible only to: case owner, pastoral staff with explicit access
- RLS policies must be tight — this is sensitive pastoral content
- Audit trail for who accessed what

### Not Allowed
- Care notes in Tend tables
- Shared mutable state with TEND
- Bypassing RLS for "convenience"

## UI Characteristics

- Restricted visibility (need-to-know)
- Case management interface (not dashboard)
- Rich notes, follow-up tracking, history
- Clear ownership and handoff

## Example: Burnout Case (from TEND handoff)

```
Source:         tend
Signal:         Serving 6+ consecutive Sundays
Person:         Alex
Owner:          Pastor Mike
Status:         open

Notes:
- [Pastor Mike, Jan 10] Called Alex, scheduling coffee this week
- [Pastor Mike, Jan 12] Met with Alex. Taking next month off serving.
- [Pastor Mike, Feb 15] Check-in: feeling rested, ready to return
```

TEND later observes: Alex's serving pattern normalized.  
TEND doesn't know why — it just sees the outcome.

## Case Lifecycle

```
opened → in_progress → resolved → closed
                    ↘ escalated → [new case or external referral]
```

- `resolved`: Situation addressed, monitoring period
- `closed`: Case complete, no further action
- `escalated`: Needs higher-level pastoral care or external resources

## Anti-Patterns to Avoid

❌ Storing Care notes in TEND tables  
❌ TEND updating Care case status  
❌ Loose access control ("everyone can see cases")  
❌ Cases without clear ownership  
❌ Using Care as a signal/dashboard system  

## Test: Is This Feature in the Right Place?

Ask: "Does this feature **notice** or **respond**?"

- Notice → TEND
- Respond → CARE
- Both → Split it, or it's doing too much too early
