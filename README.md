# WorshipOS

WorshipOS is a multi-tenant worship planning and team coordination platform designed for churches.

It prioritizes clarity, sustainability, and real-world ministry workflows over feature bloat.
The long-term goal is to help churches plan gatherings, organize people, and care for volunteers
without burning out leaders or fragmenting data across tools.

WorshipOS is in **active early development** and intentionally narrow in scope.

---

## What WorshipOS Is (Right Now)

WorshipOS is currently:

- A **multi-tenant SvelteKit application** (UI + API in one runtime)
- Built around the concept of a **Church (Tenant)** as the hard isolation boundary
- Focused on modeling _real, concrete gatherings_ rather than abstract services

At this stage, the goal is not feature completeness.
The goal is **architectural correctness and conceptual clarity**.

---

## Core Concepts (Current Model)

- **Church (Tenant)**
  The primary isolation boundary. All data belongs to exactly one church.

- **Gathering**
  A concrete, scheduled event (date + time + context).
  This replaces earlier “service instance” terminology and is the canonical domain concept.

- **Gathering Group**
  A reusable grouping or pattern (e.g. “Sunday Morning”) that gatherings may be created from.

- **People / Assignments**
  People are assigned to gatherings in specific roles for visibility and care.

---

## What WorshipOS Is _Not_ (Yet)

WorshipOS is intentionally **not** trying to replace everything at once.

Not yet included:

- Full RBAC / permissions
- Advanced scheduling automation
- Music licensing or chord chart management
- Mobile applications
- Production-grade authentication

These are explicitly deferred in favor of correctness at the core.

---

## Architecture (Source of Truth)

- **Runtime API:** `ui/src/routes/api/**` (SvelteKit `+server.ts`)
- **UI:** SvelteKit routes under `ui/src/routes/**`
- **Database:** PostgreSQL with SQL-first access

Key architecture documents:

- `ARCHITECTURE.md` — system boundaries, vocabulary, and rationale
- `TODO.md` — intentional follow-up work and deferred decisions
- `DB_MIGRATION_PLAN.md` — future plan for aligning DB naming with domain language

Legacy Express code exists only for reference under `dev/legacy/`.

---

## Short-Term Development Focus

### Phase 1: Foundations

1. Repository hygiene and documentation
2. Canonical domain language (“gatherings”)
3. Stable API boundaries
4. Gathering lifecycle (draft → published → locked)
5. One complete vertical slice (end-to-end)

At the end of this phase, WorshipOS should feel **boringly reliable** for one real workflow.

---

## Tech Stack

- Framework: SvelteKit
- Language: TypeScript
- Database: PostgreSQL
- Data access: raw SQL (no ORM)
- Local dev: Docker (optional)

---

## Design Philosophy

- Multi-tenancy is non-negotiable
- Boundaries matter more than naming perfection
- Past gatherings should not silently change
- Software should reduce anxiety, not create it
- Deferred work should be documented, not hidden

---

## Status

Early development.
APIs, schemas, and UI are subject to change as the architecture stabilizes.
