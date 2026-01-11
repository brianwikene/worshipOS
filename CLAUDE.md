# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WorshipOS is a multi-tenant worship planning and team coordination platform for churches. It's a SvelteKit application with UI + API in one runtime, backed by PostgreSQL with SQL-first data access (no ORM).

## Constitutional Document

**`docs/Guidebook-4.md` is the canonical source of truth for philosophy, theology, and product principles.** Nothing in the codebase may contradict it. Key principles:

- **Trust is the primary feature** — If a feature treats people like cogs, it does not belong
- **We don't rewrite reality** — Past events are preserved; changes are appended, not rewritten
- **Metrics serve people, not the other way around** — No scoring, ranking, or inferring spiritual maturity
- **The Calm Interface Mandate** — Calm is a pastoral commitment: reduce cognitive load, avoid urgency, never shame
- **Tending is care, not control** — The system notices patterns; humans discern and respond
- **Archive, don't delete** — Deletion is almost always a lie about history

If a feature increases visibility or interpretive power in a way that risks dignity, it must be redesigned or rejected.

## Development Commands

All commands run from the `ui/` directory:

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build
npm run check        # TypeScript + Svelte type checking
npm run test         # Run unit tests (Vitest)
npm run lint         # Check formatting (Prettier)
npm run format       # Auto-format code
```

Optional Docker setup at repo root: `docker-compose up -d` starts PostgreSQL 16 + Adminer.

## Architecture

### Source of Truth
- **API endpoints:** `ui/src/routes/api/**` (SvelteKit `+server.ts` files)
- **UI pages:** `ui/src/routes/**`
- **Migrations:** `supabase/migrations/` (ordered SQL files)

### Database Access (Dual Pattern)
- **Legacy PostgreSQL:** `ui/src/lib/server/db.ts` (raw SQL via `pg` pool) — used by most routes
- **Supabase:** `locals.supabase` client — used by /care routes for auth + RLS
- Auth context available via `locals.user` from Supabase session

### Critical Documents
- `docs/Guidebook-4.md` — **Constitutional document** (philosophy, theology, product principles)
- `ARCHITECTURE.md` — System boundaries and rationale
- `TODO.md` — Intentional deferred work
- `DB_MIGRATION_PLAN.md` — Future DB rename plan

### Domain Language (Important)
The system uses different terminology at different layers:

| Public/API | Database (Legacy) |
|------------|-------------------|
| Gathering | service_instances |
| Gathering Group | service_groups |
| gathering_id | service_instance_id |

**API and UI must use "gatherings"**. The database uses legacy `service_*` names intentionally. Do not leak internal names into API responses.

### Multi-Tenancy
- Tenant boundary: Church (`church_id` column on all tables)
- Required: `X-Church-Id` header in all API requests
- Access via: `event.locals.churchId` in server code

### Data Loading Pattern
Prefer `+page.ts` load functions over `$page` store or `onMount`:

```typescript
// +page.ts
export const load = async ({ fetch }) => {
  const data = await apiJson(fetch, '/api/gatherings');
  return { data };
};
```

## Accessibility Rules (Mandatory)

These are strictly enforced:

1. **Semantic HTML first** — Use `<button>`, `<a>`, `<input>`, not `<div>` with click handlers
2. **No warning suppression** — Never use `svelte-ignore` or `eslint-disable` for a11y warnings
3. **Labels required** — Every `<label>` must be associated with a control via `for` or wrapping
4. **Keyboard accessible** — All interactive elements must be Tab-reachable with visible focus states
5. **Zero a11y warnings** — `npm run dev` must emit no Svelte accessibility warnings

## API Patterns

Endpoints follow REST conventions with nested resources:

```
GET    /api/gatherings              # List gatherings
GET    /api/gatherings/[id]         # Single gathering with roster
GET    /api/gatherings/[id]/roster  # Assignments for gathering
GET    /api/gatherings/[id]/songs   # Songs for gathering
GET    /api/people                  # List people
GET    /api/roles                   # List roles
```

SQL queries use `json_agg` and `json_build_object` for aggregated responses.

## Core Philosophy
Soul care over logistics. We build for pastors, not project managers.

## The TEND / CARE Boundary

**One rule governs everything:**
> TEND notices. CARE responds.

### TEND (`/tend`)
- A **lens**, not a container
- Signals, patterns, thresholds, dashboards
- Answers: "Who might need attention?"
- Broadly visible, low-sensitivity
- **Never** acts inside a Care case
- **Never** stores narratives or assigns responsibility
- Queries `v_tend_burnout_signals` view via legacy PostgreSQL

### CARE (`/care`)
- A **container**, not a lens
- Cases, owners, notes, follow-ups
- Answers: "What are we doing about this?"
- Tightly controlled access (RLS/RBAC)
- May contain sensitive pastoral content
- Persists as history
- Uses Supabase for auth + RLS

### The Handoff
TEND may trigger CARE (one-way):
- "Create Care Case?" button
- Passes minimal context (signal type, timestamp, summary)
- TEND does not follow the story after handoff

CARE outcomes may *indirectly* affect TEND:
- Schedule changes → TEND sees healthier patterns
- TEND has no memory of *why* — just observes the new state

### Schema Constraints
Allowed:
- `care_cases.source = 'tend'`
- `care_cases.source_signal_id` (FK to signal, not to notes)
- Timestamps, non-sensitive summary text

**Not allowed:**
- Care notes in Tend tables
- Tend tables updated by Care workflows
- Shared mutable state between modules

### When Proposing Features
If a feature violates "TEND notices, CARE responds," it's either:
- In the wrong module, or
- Doing too much too early

---

## Current State (WIP)
- Auth: Fake/stubbed (disk-based), moving to Supabase
- RLS/RBAC: In progress
- Deployment: Local → Supabase → Vercel
- Philosophy: 37signals-style opinionated MVP with polish + security

## Key Constraints

- **Do not rename DB tables** without following `DB_MIGRATION_PLAN.md`
- **No partial migrations** — DB objects must be renamed together in ordered migrations
- **Prefer editing existing files** over creating new ones
- **Use shared components** (`sys-*` classes) over per-page solutions
- **Legacy Express code** in `dev/legacy/` is reference only — do not modify
