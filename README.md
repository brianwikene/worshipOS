# WorshipOS

WorshipOS is a multi-tenant worship planning and team coordination platform designed for churches. It focuses on clarity, sustainability, and real-world ministry workflows—not feature bloat.

The long-term vision is a system that helps churches plan services, organize people, and care for volunteers without burning out leaders or fragmenting data across tools.

Right now, WorshipOS is in **active early development** and intentionally narrow in scope.

---

## What WorshipOS Is (Right Now)

WorshipOS is currently:

- A **multi-tenant backend + UI** for worship service planning
- Built around the concept of a **Church (Tenant)** as the hard isolation boundary
- Exploring a clean separation between:
  - **Tenancy** (church-level data isolation)
  - **Authorization scopes** (campus, team, role)
  - **Service instances** (specific dates/times that eventually become immutable)

The goal at this stage is not feature completeness—it is **architectural correctness**.

---

## Core Concepts (Working Model)

- **Church (Tenant)**  
  The primary isolation boundary. All data belongs to exactly one church.

- **Service Template**  
  A reusable definition (e.g. “Sunday Morning Service”).

- **Service Instance**  
  A concrete occurrence of a service on a date/time. These will eventually become **read-only / locked** once finalized.

- **People / Teams**  
  Assigned to service instances for scheduling and visibility.

---

## What WorshipOS Is *Not* (Yet)

WorshipOS is intentionally **not** trying to replace everything at once.

Not yet included:
- Full RBAC / permissions
- Music licensing or chord charts
- Advanced scheduling automation
- Mobile apps
- Production-grade authentication

---

## Short-Term Development Path

### Phase 1: Foundations

1. Repository hygiene and structure
2. Canonical database schema + seed path
3. Dev-mode tenant switching
4. Service instance lifecycle (draft → published → locked)
5. One complete vertical slice (end-to-end)

At the end of this phase, WorshipOS should feel **boringly reliable** for one real-world workflow.

---

## Tech Stack

- Frontend: Svelte / SvelteKit
- Backend: Node.js
- Database: PostgreSQL
- Local Dev: Docker / Docker Compose

---

## Design Philosophy

- Multi-tenancy is non-negotiable
- APIs enforce rules, not just the UI
- Past services should not silently change
- Software should reduce anxiety, not create it

---

## Status

Early development. APIs, schemas, and UI are subject to change.
