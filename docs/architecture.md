# WorshipOS Architecture

This document exists so future Brian doesn’t have to reconstruct the system from memory.

It captures **intent**, not just implementation.

---

## Core Principle: Tenancy First

**Church (Tenant)** is the hard security and data isolation boundary.

- Every row of data belongs to exactly one church
- No query should ever return data from multiple churches
- Tenancy is enforced at the API layer, not trusted to the UI

If tenancy breaks, everything breaks.

---

## Tenancy Model

- `church_id` (UUID) exists on all primary tables
- All reads and writes are scoped by `church_id`
- In development, the active tenant is explicitly selected
- In production, the tenant will be derived from authentication/session context

There is no “default” tenant.

---

## Dev-Mode Tenant Switching

Dev mode allows switching the active church context to surface bugs early.

Expected behavior:
- UI selects an active `church_id`
- API requests include that tenant context (e.g. header)
- Backend middleware resolves the active tenant once per request
- Queries consume tenant context implicitly

If switching tenants does not visibly change data, something is wrong.

---

## Authorization vs Isolation

These are not the same thing.

- **Isolation Boundary:** Church (Tenant)
- **Authorization Scopes:** Campus, Team, Role

Authorization scopes filter visibility and permissions *within* a church.
They must never bypass tenant isolation.

---

## Service Lifecycle

Service instances represent real-world moments in time.

Planned lifecycle:
1. **Draft** – freely editable
2. **Published** – visible to teams
3. **Locked** – read-only; historical record

Both the UI and API must enforce lifecycle rules.

The API is the final authority.

---

## Vertical Slice Strategy

Features are developed end-to-end, not in isolation.

A valid slice includes:
- Database schema
- API endpoints
- Business rules
- UI state
- Error handling

One solid slice is worth more than ten half-built ones.

---

## Non-Goals (For Now)

- Full RBAC
- Multi-campus complexity
- Mobile clients
- Integrations

These come *after* correctness.

---

## Guiding Heuristic

If a feature makes it easier to accidentally:
- edit the past
- leak tenant data
- confuse responsibility

…it is probably premature.

Build slow. Build honest.
