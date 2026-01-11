# TEND — Signal Layer

> **Core principle:** TEND notices. It never responds.

## What TEND Is

- A **lens** — not a container
- A **signal layer** — pattern detection, thresholds, dashboards
- A **preventative system** — early warning, not intervention

TEND answers: **"Who might need attention?"**

## What TEND Is Not

TEND never:
- Acts inside a Care case
- Assigns responsibility
- Records sensitive narratives
- Becomes a permanent record
- Requires confidentiality controls beyond "appropriate visibility"

## Boundaries

### TEND → CARE (allowed, one-way)

TEND may trigger Care case creation:
- UI: "Create Care Case?" button
- Passes: signal type, timestamp, non-sensitive summary
- Then: **hands off completely**

TEND does not follow the story after handoff.

### CARE → TEND (indirect only)

Care actions may change patterns TEND observes:
- Example: Care reduces someone's serving load → TEND later sees healthier pattern
- TEND has no memory of *why* — just observes outcomes

**TEND reads outcomes. CARE writes stories.**

## Schema Constraints

### Allowed
```
care_cases.source = 'tend'
care_cases.source_signal_id  -- FK to signal, not to notes
timestamps
non-sensitive summary text
```

### Not Allowed
- Care notes in Tend tables
- Tend tables updated by Care workflows
- Shared mutable state between modules
- TEND storing anything that requires access control

## UI Characteristics

- Broadly visible to leaders
- Soft flags, not alarms
- Gentle language (nudges, not warnings)
- Dashboard-style presentation

## Example: Volunteer Burnout Signal

```
Signal:     Serving 6+ consecutive Sundays
Visibility: Team leads, pastoral staff
UI:         Soft highlight + "Create Care Case?" action
Data:       person_id, signal_type, threshold, current_count, last_updated
```

When "Create Care Case?" is clicked:
1. Minimal context passed to Care
2. Care case created with `source = 'tend'`
3. TEND's job is done — it doesn't track the case

## Anti-Patterns to Avoid

❌ TEND adding notes to Care cases  
❌ TEND changing Care status  
❌ TEND as a Care UI shortcut  
❌ Storing pastoral narratives in TEND tables  
❌ Permission logic that spans both modules  

## Test: Is This Feature in the Right Place?

Ask: "Does this feature **notice** or **respond**?"

- Notice → TEND
- Respond → CARE
- Both → Split it, or it's doing too much too early
