// /architecture.md
# Architecture Overview — worshipOS

This document describes the **current architecture**, **intentional boundaries**, and **deferred decisions** of the worshipOS codebase.

It is not a historical record of how the system used to work.
It describes how the system is intended to work _now_.

---

## High-level shape

worshipOS is a SvelteKit application with:

- **UI + API in one app** (SvelteKit routes)
- **Postgres** as the primary datastore
- **SQL-first data access** (no ORM)

There is no standalone backend service.
The SvelteKit app is the runtime.

---

## Source of truth

### Runtime API (canonical)

- Location: `ui/src/routes/api/**`
- Technology: SvelteKit `+server.ts` endpoints
- Vocabulary: **gatherings**, people, families, roles, assignments

All active API development happens here.

### UI

- Location: `ui/src/routes/**`
- Framework: SvelteKit + Svelte
- Data loading should prefer `+page.ts` load functions over `$page` store or `onMount`.

### Database

- Technology: Postgres
- Access pattern: raw SQL via `pg`
- Migrations: SQL files (order matters)

The database schema currently contains **legacy terminology**.
This is intentional and documented.

---

## Domain language (important)

### Public / conceptual language

At the API and UI boundary, the system uses:

- **Gathering** — a concrete, scheduled event (formerly “service instance”)
- **People**, **Families**
- **Assignments**
- **Songs**
- **Roles**

This language is considered **canonical**.

### Internal / database language (legacy)

The database schema still uses names such as:

- `service_instances`
- `service_instance_id`
- `service_groups`

These are treated as **implementation details**, not domain concepts.

The system intentionally translates _conceptually_ without immediately renaming tables.

---

## Why “gatherings” replaced “services”

The term **service** was overloaded and ambiguous:

- service as worship gathering
- service as software/API
- service as ministry/program

“Gathering” is:

- more pastoral
- less technical
- more theologically grounded
- clearer in UI and conversation

As a result:

- Routes are `/gatherings`
- UI language is “gathering”
- API contracts speak in “gatherings”

The database rename is deferred (see below).

---

## Deferred architectural decision: DB renaming

### Current state (intentional)

- API + UI use **gatherings**
- DB tables still use `service_*` names
- SQL queries live in `ui/src/routes/api/**`

This is a **deliberate pause**, not unfinished work.

### Why it’s deferred

- Renaming tables has high blast radius
- Requires ordered migrations
- Requires updating all SQL joins and foreign keys
- Does not unlock user value right now

### Guardrails

- Do not leak `service_instance_id` into API responses
- Prefer aliasing in SQL (`AS gathering_id`) if needed
- Do not partially rename DB objects

A future migration plan is documented in `TODO.md`.

---

## Legacy code

### Express API

- Location: `dev/legacy/express-api/`
- Status: **inactive**
- Purpose: historical reference only

This code is not wired into the runtime.
Do not add features here.

---

## Data loading philosophy (UI)

Preferred pattern:

- Fetch data in `+page.ts` via `load()`
- Pass data into components via props
- Avoid `$page` store reads for core data

This enables:

- SSR
- explicit data dependencies
- better type inference
- easier testing

Pages still using `$page` are tracked in `TODO.md`.

---

## Design principles (summary)

- **Clear boundaries beat perfect naming**
- **Public language matters more than internal naming**
- **Deferred work should be documented, not hidden**
- **Migrations should be deliberate, not opportunistic**
- **Copilot should be guided, not trusted blindly**

---

## If you are changing architecture

Before making large changes:

1. Update this document
2. Update `TODO.md` if deferring work
3. Keep API contracts stable
4. Prefer small, reversible steps

If you are unsure which layer to change, start at the boundary and work inward.

---

_Last updated: 2026-01-03_
