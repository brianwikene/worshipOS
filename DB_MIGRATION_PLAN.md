# Database Migration Plan — service_* → gathering_*

This document outlines a **future, intentional plan** to migrate legacy
`service_*` database tables and columns to match the current domain language
used by the API and UI (**gatherings**).

This migration is **not active work**.
It exists to reduce risk when the rename is eventually undertaken.

For architectural rationale, see `ARCHITECTURE.md`.
For deferred status, see `TODO.md`.

---

## Goals

- Align database terminology with domain language
- Eliminate legacy `service_*` naming
- Preserve all existing data
- Avoid breaking API contracts

---

## Non‑Goals

- This migration does **not** introduce new features
- This migration does **not** change application behavior
- This migration does **not** happen incrementally or partially

---

## Current State (Baseline)

### Public / API Layer
- Routes: `/api/gatherings/**`
- UI language: **gatherings**
- Client code does **not** reference `service_instance_id`

### Database (Legacy Naming)
- `service_instances`
- `service_groups`
- `service_instance_songs`
- `service_assignments`

These are treated as **internal implementation details**.

---

## Target State

### Tables

| Legacy Table | New Table |
|-------------|-----------|
| service_instances | gatherings |
| service_groups | gathering_groups |
| service_instance_songs | gathering_songs |
| service_assignments | gathering_assignments |

### Columns

| Legacy Column | New Column |
|--------------|------------|
| service_instance_id | gathering_id |
| service_group_id | gathering_group_id |

---

## Migration Strategy (High Level)

### Phase 0 — Preconditions
- All API routes confirmed under `/gatherings`
- No UI or client code depends on legacy column names
- All SQL queries centralized in `ui/src/routes/api/**`

---

### Phase 1 — Preparation (Safe)
- Add **views or aliases** (optional) to validate naming
- Ensure all queries explicitly alias IDs (`AS gathering_id`)
- Add test coverage around gathering creation and retrieval

_No destructive changes in this phase._

---

### Phase 2 — Table Renames
Use transactional Postgres migrations:

```sql
ALTER TABLE service_instances RENAME TO gatherings;
ALTER TABLE service_groups RENAME TO gathering_groups;
ALTER TABLE service_instance_songs RENAME TO gathering_songs;
ALTER TABLE service_assignments RENAME TO gathering_assignments;
```

---

### Phase 3 — Column Renames

```sql
ALTER TABLE gatherings
  RENAME COLUMN service_group_id TO gathering_group_id;

ALTER TABLE gathering_songs
  RENAME COLUMN service_instance_id TO gathering_id;

ALTER TABLE gathering_assignments
  RENAME COLUMN service_instance_id TO gathering_id;
```

---

### Phase 4 — Constraint & Index Updates
- Rename foreign key constraints
- Rename indexes
- Update any triggers or views

_All changes must be atomic per migration file._

---

### Phase 5 — Code Update
- Update all SQL queries to reference new table/column names
- Remove temporary aliases
- Run full regression test pass

---

### Phase 6 — Cleanup
- Remove any transitional views
- Update documentation
- Remove legacy references from comments

---

## Risk Management

### High‑Risk Areas
- Foreign key constraints
- Implicit joins
- Hard‑coded SQL strings

### Mitigations
- One migration per phase
- Rollback scripts for each step
- Execute during low‑risk window
- Validate with staging data

---

## Rollback Strategy

Each migration must include a reversible step:

```sql
ALTER TABLE gatherings RENAME TO service_instances;
```

No irreversible changes without a verified backup.

---

## When to Execute This Plan

This migration should only be attempted when:
- Feature velocity is low
- Schema churn has stabilized
- Adequate testing exists
- There is a clear owner for the work

Until then, this document serves as a **risk‑reduction artifact**, not a task list.

---

_Last updated: 2026-01-03_
