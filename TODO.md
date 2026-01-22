// /TODO.md
# TODO — Intentional, Tracked Work

This file documents **known, intentional follow-up work**.
Items here are deferred by design, not forgotten or accidental.

For architectural context and rationale, see `ARCHITECTURE.md`.

---

## 1. UI Data Loading Improvements

### Migrate from `$page` store / `onMount` to `load()` functions

**Priority:** Medium
**Scope:** Incremental, page-by-page
**Goal:** Better SSR, clearer data flow, stronger typing

Pages that fetch API data should move fetching logic into SvelteKit
`+page.ts` load functions instead of using `$page` store reads or `onMount`.

### Target pattern

```ts
// +page.ts
export const load = async ({ params, fetch }) => {
  const gathering = await apiJson(fetch, `/api/gatherings/${params.id}`);
  const roster = await apiJson(fetch, `/api/gatherings/${params.id}/roster`);
  return { gathering, roster };
};
```

### Pages to migrate (suggested order)

- [ ] `/gatherings/[id]/+page.svelte`
  - currently fetches: gathering, roster, songs
- [ ] `/gatherings/+page.svelte`
  - partially implemented in `+page.ts`
- [ ] `/people/[id]/+page.svelte`
- [ ] `/families/[id]/+page.svelte`
- [ ] `/+page.svelte` (homepage)

### Rules / non-goals

- Do not mix `$page` store reads with `load()` results
- Do not migrate pages that do not fetch data
- Migrate one page at a time; avoid large refactors

---

## 2. Database Terminology Migration (Deferred)

### Rename legacy `service_*` tables to `gathering_*`

**Priority:** Low
**Status:** Deferred by design
**Current state:** API + UI already use “gatherings”

The database schema still uses legacy service-oriented names.
These are treated as **internal implementation details** for now.

### Future rename candidates

- [ ] `service_instances` → `gatherings`
- [ ] `service_groups` → `gathering_groups`
- [ ] `service_instance_songs` → `gathering_songs`
- [ ] `service_assignments` → `gathering_assignments`

### Constraints

- Changes must be done via ordered Postgres migrations
- Existing data must be preserved
- All SQL in `ui/src/routes/api/**` must be updated together
- API responses must not expose legacy names

### Explicit non-goals

- Do NOT block feature work on this rename
- Do NOT partially rename tables or columns
- Do NOT rename DB objects without migrations

A future migration plan should be created before attempting this work.

---

_Last updated: 2026-01-03_
