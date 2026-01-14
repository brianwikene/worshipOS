# GEMINI.md — WorshipOS Context for AI

> **This document is derived from `AGENTS.md`. Refer to `AGENTS.md` for the full instruction set.**

## 1. Project Overview

WorshipOS is a multi-tenant worship planning and team coordination platform for churches. It prioritizes **soul care over logistics**.

### Tech Stack
- **Framework**: SvelteKit (UI + API in one runtime)
- **Database**: PostgreSQL via Supabase (migrating from legacy `pg` pool)
- **Auth**: Supabase Auth with RLS
- **Styling**: Tailwind CSS + system classes (`sys-*`)
- **Migrations**: `supabase/migrations/`

## 2. Constitutional Document

**`docs/Guidebook-4.md` is the canonical source of truth.** Nothing in the codebase may contradict it.
Key Principles:
- **Trust is the primary feature**
- **We don't rewrite reality** (changes appended, not overwritten)
- **Archive, don't delete**
- **The Calm Interface Mandate**

## 3. The TEND / CARE Boundary

**One rule governs everything:** "TEND notices. CARE responds."

### TEND (`/tend`)
- **Lens**, not container.
- Signals, patterns, thresholds.
- Answers: "Who might need attention?"
- **Never** acts inside a Care case.
- Uses `v_tend_burnout_signals` view.

### CARE (`/care`)
- **Container**, not lens.
- Cases, owners, notes.
- Answers: "What are we doing about this?"
- Persists as history.
- Tightly controlled access (RLS).

## 4. Domain Language

The system uses different terminology at different layers:

| Public/API | Database (Legacy) |
|------------|-------------------|
| **Gathering** | `service_instances` |
| **Gathering Group** | `service_groups` |

**Rules:**
- API and UI must use "gatherings".
- Database uses legacy `service_*` names intentionally.
- Alias queries: `SELECT service_instance_id AS gathering_id`
- Do NOT rename DB tables without following `DB_MIGRATION_PLAN.md`.

## 5. Multi-Tenancy

- **Tenant boundary**: Church (`church_id` column).
- **Required header**: `X-Church-Id` in API requests.
- **Access in code**: `event.locals.churchId`.
- Hard isolation boundary.

## 6. Database Access

**Status**: Migrating from legacy `pg` pool to Supabase client.

- **New/Refactored Code**: Use Supabase client.
  ```typescript
  const { data } = await locals.supabase
    .from('table_name')
    .select('*')
    .eq('church_id', locals.churchId);
  ```
- **Legacy Code**: `pool` from `$lib/server/db` (Avoid for new code).

## 7. Data Loading Pattern

Prefer `+page.ts` load functions over `$page` store or `onMount` to enable SSR.

```typescript
// +page.ts
export const load = async ({ fetch, locals }) => {
  const { data } = await locals.supabase.from('gatherings').select('*');
  return { gatherings: data };
};
```

## 8. API Patterns

Endpoints follow REST conventions nested under `/api`.
- Use `json_agg` and `json_build_object` for aggregated responses.
- Return domain language (e.g., `gathering_id`) in JSON, not DB column names.

## 9. Accessibility & UI (Summary)

**WorshipOS treats accessibility as a first-class feature.**
- **Semantic HTML**: Use `<button>`, `<a>`, `<label>`, `<input>`. No `div` buttons.
- **Keyboard-First**: All actions reachable by keyboard. Focus must be visible.
- **No Warning Suppression**: Zero Svelte a11y warnings allowed.
- **Scanability**: Table rows have visual anchors (Avatars/Icons).
- **Consistency**: Use `sys-*` classes (tailwind) and existing components.

## 10. Development Commands

All run from `ui/`:
```bash
npm run dev          # Start Vite server
npm run build        # Production build
npm run check        # Type checking
npm run test         # Unit tests (Vitest)
npm run lint         # Format check
```

## 11. File Structure

```
ui/
├── src/
│   ├── routes/
│   │   ├── api/          # API endpoints
│   │   ├── tend/         # TEND module
│   │   ├── care/         # CARE module
│   ├── lib/
│   │   ├── server/db.ts  # Legacy pg pool
│   │   └── components/   # Shared components
```

## 12. Key Constraints

1. Do NOT rename DB tables without plan.
2. Prefer editing existing files.
3. Constitutional compliance (`Guidebook-4.md`).
4. Accessibility is non-negotiable (Regenerate code if violated).
