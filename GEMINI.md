// /GEMINI.md
# GEMINI.md — WorshipOS Context for AI

> **This document is derived from `AGENTS.md`. Refer to `AGENTS.md` for the full instruction set.**

## 1. Project Overview

WorshipOS is a multi-tenant worship planning and team coordination platform for churches. It prioritizes **soul care over logistics** — we build for pastors, not project managers.

### Tech Stack
- **Framework**: SvelteKit (UI + API in one runtime)
- **Database**: PostgreSQL via Supabase (migrating from legacy `pg` pool)
- **Auth**: Supabase Auth with RLS
- **Styling**: Tailwind CSS + system classes (`sys-*`)
- **Migrations**: `supabase/migrations/`

## 2. Constitutional Document

**`docs/Guidebook-4.md` is the canonical source of truth.** Nothing in the codebase may contradict it. Deviations require updating the Guidebook first — only for security, accessibility, or best practices.

### Core Principles

| Principle | Meaning |
|-----------|---------|
| **Trust is the primary feature** | No features that treat people like cogs |
| **We don't rewrite reality** | Past events preserved; changes appended, not overwritten |
| **Metrics serve people** | No scoring, ranking, or inferring spiritual maturity |
| **The Calm Interface Mandate** | Reduce cognitive load, avoid urgency, never shame |
| **Archive, don't delete** | Deletion is a lie about history |

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

TEND may trigger CARE (one-way handoff). No shared mutable state between modules.

## 4. Domain Language

The system uses different terminology at different layers:

| Public/API | Database (Legacy) |
|------------|-------------------|
| **Gathering** | `service_instances` |
| **Gathering Group** | `service_groups` |
| **gathering_id** | `service_instance_id` |

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
  const { data, error } = await locals.supabase
    .from('table_name')
    .select('*')
    .eq('church_id', locals.churchId);
  ```
- **Legacy Code**: `pool` from `$lib/server/db` (Avoid for new code; rewrite when touching).

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

## 9. Accessibility & UI

**WorshipOS treats accessibility as a first-class feature.**

1. **Semantic HTML** — Use `<button>`, `<a>`, `<label>`, `<input>`. No `div` buttons.
2. **Keyboard-First** — All actions reachable by keyboard. Focus must be visible.
3. **Labels required** — Every input has a `<label>`. Placeholder is not a label.
4. **No focus on page load** — Focus moves only for dialogs, user action, error correction.
5. **Zero a11y warnings** — `npm run dev` must emit no Svelte accessibility warnings.
6. **No Warning Suppression** — Never use `svelte-ignore` or `eslint-disable` for a11y.
7. **Scanability** — Table rows have visual anchors (Avatars for people, Icons for songs).
8. **Consistency** — Use `sys-*` classes and existing components.

**AI Code Rule:** If generated code violates accessibility, regenerate — don't patch.

## 10. Development Commands

All run from `ui/`:

```bash
npm install          # Install dependencies
npm run dev          # Start Vite server (port 5173)
npm run build        # Production build
npm run check        # TypeScript + Svelte type checking
npm run test         # Unit tests (Vitest)
npm run lint         # Format check
npm run format       # Auto-format code
```

## 11. File Structure

```
ui/
├── src/
│   ├── routes/
│   │   ├── api/          # API endpoints (+server.ts)
│   │   ├── tend/         # TEND module (lens)
│   │   ├── care/         # CARE module (container)
│   ├── lib/
│   │   ├── server/db.ts  # Legacy pg pool (being phased out)
│   │   └── components/   # Shared components
│   └── app.css           # Global styles

supabase/
└── migrations/           # Ordered SQL migration files

docs/
├── Guidebook-4.md        # Constitutional document
└── ...
```

## 12. Key Documents

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Complete AI agent instructions (master) |
| `docs/Guidebook-4.md` | Constitutional document |
| `ARCHITECTURE.md` | System boundaries and rationale |
| `TODO.md` | Intentional deferred work |
| `DB_MIGRATION_PLAN.md` | Future DB rename plan |

## 13. Key Constraints

1. **Do NOT rename DB tables** without following `DB_MIGRATION_PLAN.md`.
2. **Prefer editing existing files** over creating new ones.
3. **Use shared components** (`sys-*` classes) over per-page solutions.
4. **Constitutional compliance** — All features must align with `docs/Guidebook-4.md`.
5. **Accessibility is non-negotiable** — Regenerate code if it violates rules.
