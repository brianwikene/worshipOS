// /AGENTS.md
# AGENTS.md — WorshipOS AI Agent Instructions

> **This is the canonical instruction set for all AI coding assistants working on WorshipOS.**
> Tool-specific files (CLAUDE.md, GEMINI.md, copilot-instructions.md) should reference or extract from this document.

---

## Quick Reference

| What | Where |
|------|-------|
| Constitutional document | `docs/Guidebook-4.md` |
| Architecture | `ARCHITECTURE.md` |
| Deferred work | `TODO.md` |
| DB migration plan | `DB_MIGRATION_PLAN.md` |
| Accessibility DoD | `docs/accessibility-definition-of-done.md` |
| UI generation prompts | `docs/ai-prompts/accessibility-ui-generation.md` |

---

## 1. Project Overview

WorshipOS is a multi-tenant worship planning and team coordination platform for churches. It prioritizes **soul care over logistics**—we build for pastors, not project managers.

### Tech Stack
- **Framework**: SvelteKit (UI + API in one runtime)
- **Database**: PostgreSQL via Supabase (migrating from legacy `pg` pool)
- **Auth**: Supabase Auth with RLS
- **Styling**: Tailwind CSS + system classes (`sys-*`)
- **Migrations**: `supabase/migrations/` (ordered SQL files)

### Current State
- Auth: Transitioning to Supabase (some routes still use stubbed auth)
- Database: Migrating from legacy `pg` pool → Supabase client
- RLS/RBAC: In progress
- Deployment: Local → Supabase → Vercel

---

## 2. Constitutional Document

<!-- [CRITICAL] -->

**`docs/Guidebook-4.md` is the canonical source of truth for philosophy, theology, and product principles.**

Nothing in the codebase may contradict it. If we choose to deviate, we must update the Guidebook first—and only for compelling reasons (security, accessibility, best practices), never for shiny/flashy UI elements.

### Core Principles

| Principle | Meaning |
|-----------|---------|
| **Trust is the primary feature** | If a feature treats people like cogs, it does not belong |
| **We don't rewrite reality** | Past events are preserved; changes are appended, not overwritten |
| **Metrics serve people** | No scoring, ranking, or inferring spiritual maturity |
| **The Calm Interface Mandate** | Reduce cognitive load, avoid urgency, never shame |
| **Tending is care, not control** | The system notices patterns; humans discern and respond |
| **Archive, don't delete** | Deletion is almost always a lie about history |

> If a feature increases visibility or interpretive power in a way that risks dignity, it must be redesigned or rejected.

---

## 3. The TEND / CARE Boundary

<!-- [ARCHITECTURE-CRITICAL] -->

**One rule governs everything:**
> TEND notices. CARE responds.

### TEND (`/tend`)
- A **lens**, not a container
- Signals, patterns, thresholds, dashboards
- Answers: "Who might need attention?"
- Broadly visible, low-sensitivity
- **Never** acts inside a Care case
- **Never** stores narratives or assigns responsibility
- Uses Supabase client, queries `v_tend_burnout_signals` view

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
- TEND has no memory of *why*—just observes the new state

### Schema Constraints
**Allowed:**
- `care_cases.source = 'tend'`
- `care_cases.source_signal_id` (FK to signal, not to notes)
- Timestamps, non-sensitive summary text

**Not allowed:**
- Care notes in Tend tables
- Tend tables updated by Care workflows
- Shared mutable state between modules

### Feature Proposal Test
If a feature violates "TEND notices, CARE responds," it's either:
- In the wrong module, or
- Doing too much too early

---

## 4. Domain Language

<!-- [NAMING] -->

The system uses different terminology at different layers:

| Public/API | Database (Legacy) |
|------------|-------------------|
| Gathering | service_instances |
| Gathering Group | service_groups |
| gathering_id | service_instance_id |

**Rules:**
- API and UI must use "gatherings"
- Database uses legacy `service_*` names intentionally
- Do not leak internal names into API responses
- When writing queries, alias legacy names: `SELECT service_instance_id AS gathering_id`

**Do not rename DB tables** without following `DB_MIGRATION_PLAN.md`.

---

## 5. Multi-Tenancy

- **Tenant boundary**: Church (`church_id` column on all tables)
- **Required header**: `X-Church-Id` in all API requests
- **Access in code**: `event.locals.churchId`

All data belongs to exactly one church. This is a hard isolation boundary.

---

## 6. Database Access

<!-- [DATA-ACCESS] -->

### Current Pattern (Transitional)
We are migrating from legacy `pg` pool to Supabase. As you encounter routes using the old pattern, rewrite them to use Supabase.

**Legacy pattern** (being phased out):
```typescript
// ui/src/lib/server/db.ts — DO NOT USE FOR NEW CODE
import { pool } from '$lib/server/db';
const result = await pool.query('SELECT ...');
```

**Current pattern** (use this):
```typescript
// Access via locals.supabase
const { data, error } = await locals.supabase
  .from('table_name')
  .select('*')
  .eq('church_id', locals.churchId);
```

### Migration Rules
- New routes: Always use Supabase client
- Existing routes using `pool`: Rewrite when touching that code
- Auth context: Available via `locals.user` from Supabase session

---

## 7. Data Loading Pattern

<!-- [SVELTE] -->

Prefer `+page.ts` load functions over `$page` store or `onMount`:

```typescript
// +page.ts
export const load = async ({ fetch, locals }) => {
  const { data } = await locals.supabase
    .from('gatherings')
    .select('*');
  return { gatherings: data };
};
```

This enables server-side rendering and creates explicit data dependencies.

---

## 8. API Patterns

Endpoints follow REST conventions with nested resources:

```
GET    /api/gatherings              # List gatherings
GET    /api/gatherings/[id]         # Single gathering with roster
GET    /api/gatherings/[id]/roster  # Assignments for gathering
GET    /api/gatherings/[id]/songs   # Songs for gathering
GET    /api/people                  # List people
GET    /api/roles                   # List roles
```

- Use `json_agg` and `json_build_object` for aggregated responses in raw SQL
- Return domain language in responses (not database column names)

---

## 9. Accessibility Rules

<!-- [ACCESSIBILITY-CRITICAL] -->

WorshipOS treats accessibility as a **first-class feature**, not a post-hoc fix. All code—human-written and AI-generated—must conform.

### Non-Negotiable Rules (Blockers)

#### 1. Semantic by Default
- Buttons use `<button>`
- Links use `<a href>`
- Inputs are real form controls
- **No** div/span click handlers
- **No** ARIA used to replace correct elements

#### 2. Keyboard-First Success
- All primary actions reachable by keyboard
- Logical tab order
- No keyboard traps
- Escape closes dialogs/menus

#### 3. Focus Behavior
- Focus is always visible
- **No** focus on page load
- Focus moves only for: opening/closing dialogs, explicit user action, error correction

#### 4. Labels Are Real
- Every input has a `<label>`
- Placeholder text is **not** a label
- `aria-label` only when visible labels are impossible

#### 5. Structure Reflects Meaning
- Landmarks used appropriately (`main`, `nav`, etc.)
- Headings follow logical hierarchy
- No decorative misuse of headings

#### 6. The System Never Lies
- Disabled controls are actually disabled
- Clickable-looking things are clickable
- Loading states block ghost actions

### Validation
- Errors are readable and associated with fields
- Required fields are clearly indicated
- No surprise focus jumps

### Manual 2-Minute Check (Required Before Merge)
1. Complete the flow using keyboard only
2. Confirm focus visibility everywhere
3. Verify labels exist
4. Check nothing "looks interactive" but isn't

**Fail any → not done.**

### AI Code Rule
If AI-generated code violates this Definition of Done:
- **Regenerate**
- Do not patch structural mistakes

### No Warning Suppression
- **Never** use `svelte-ignore` or `eslint-disable` for a11y warnings
- Warnings indicate architectural drift and must be resolved at source
- `npm run dev` must emit **zero** Svelte accessibility warnings

---

## 10. AI UI Generation Prompt Footer

<!-- [AI-GENERATION] -->

Include this at the end of every UI-related AI request:

> **WorshipOS Accessibility Definition of Done (MVP Baseline)**
> - Use semantic HTML elements (`button`, `a`, `label`, `input`, `select`, `textarea`, `nav`, `main`, `section`, `header`).
> - No `div` or `span` used as interactive elements.
> - No `role="button"` or `tabindex` hacks unless semantic HTML is impossible (rare; explain if used).
> - Keyboard navigation must work for the entire flow.
> - Focus must be visible and predictable.
> - Do NOT move focus on page load.
> - Inputs must have real labels (placeholder text is not a label).
> - Use ARIA only when semantic HTML cannot express the intent.
> - Output code that already conforms to these rules.
>
> If any rule is violated, regenerate the code.

---

## 11. UI Conventions

### Iconography & Density
- Tables are interaction surfaces, not just layouts
- People tables: relational/pastoral—identity anchors (Avatar), actions recede
- Songs tables: operational/catalog—strong scanability, actions recede

### Scanability Rules (Tables)
- Every table row has a leading visual anchor in the first column
  - People: Avatar
  - Songs: ObjectMark or stable-width anchor
- Row actions are visually secondary
  - Prefer `sys-icon-btn--ghost` for non-destructive actions
  - Destructive actions may be ghosted but retain danger emphasis on hover/focus

### Consistency Rules
- Reuse existing system classes (`sys-*`) and existing SVGs/components
- Do not invent new icon systems
- Prefer small, reversible diffs
- Preserve ARIA labels and keyboard behavior
- Add `type="button"` to buttons inside rows

### When Editing Routes
- Keep changes local unless a shared type/style is clearly reused
- If adding shared styles, add to `ui/src/app.css` using existing tokens/variables

---

## 12. Development Commands

All commands run from the `ui/` directory:

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build
npm run check        # TypeScript + Svelte type checking
npm run test         # Run unit tests (Vitest)
npm run lint         # Check formatting (Prettier)
npm run format       # Auto-format code
```

### Database Migrations

```bash
# Migrations are in supabase/migrations/
# Apply via Supabase CLI or dashboard
```

### Docker (Optional)
At repo root: `docker-compose up -d` starts PostgreSQL 16 + Adminer.

---

## 13. File Structure

```
ui/
├── src/
│   ├── routes/
│   │   ├── api/          # API endpoints (+server.ts files)
│   │   ├── tend/         # TEND module (lens)
│   │   ├── care/         # CARE module (container)
│   │   └── ...           # Other UI routes
│   ├── lib/
│   │   ├── server/       # Server-only code
│   │   │   └── db.ts     # Legacy pg pool (being phased out)
│   │   └── components/   # Shared components
│   └── app.css           # Global styles
├── package.json
└── ...

supabase/
└── migrations/           # Ordered SQL migration files

docs/
├── Guidebook-4.md        # Constitutional document
├── accessibility-definition-of-done.md
├── accessibility-tooling.md
└── ai-prompts/
    └── accessibility-ui-generation.md
```

---

## 14. Key Constraints

1. **Do not rename DB tables** without following `DB_MIGRATION_PLAN.md`
2. **No partial migrations**—DB objects must be renamed together in ordered migrations
3. **Prefer editing existing files** over creating new ones
4. **Use shared components** (`sys-*` classes) over per-page solutions
5. **Constitutional compliance**—all features must align with `docs/Guidebook-4.md`
6. **Accessibility is non-negotiable**—zero warnings, semantic HTML, keyboard-first

---

## 15. Tool-Specific Notes

### Claude Code
- Primary development tool
- Reference this file as `AGENTS.md` or symlink to `CLAUDE.md`
- Can use full document

### GitHub Copilot
- Use `.github/copilot-instructions.md`
- Extract relevant sections (accessibility rules are critical)

### Google Antigravity / Gemini
- Use `.gemini/GEMINI.md` in project root
- Antigravity also reads `AGENTS.md` automatically if configured
- Extract relevant sections, keeping accessibility and architecture rules

---

## Appendix A: Accessibility Tooling

### CI Blockers (Must Fix Before Merge)
- Non-semantic interactive elements
- Missing labels on inputs
- Keyboard-inaccessible primary controls
- Focus trap bugs in modals/dialogs

### CI Warnings (Allowed, But Tracked)
- Contrast edge cases
- Suboptimal ARIA usage
- Imperfect landmarks/headings
- Non-critical screen reader enhancements

**Rule:** Repeated warnings across PRs count toward escalation trigger.

### When to Run Runtime Audits
- Adding complex UI patterns (tables, drag/drop, calendars, rich editors)
- Repeated warnings appear in PRs
- Preparing a milestone release
- External requirement trigger fires (WCAG AA needed)

---

## Appendix B: Form Generation Prompt

```
Generate a semantic, accessible form.

**Purpose:**
[What the form does]

**Fields:**
- [Name + type]
- [Name + type]

**Validation Rules:**
[If any]

**Accessibility Requirements:**
- Every field has an associated `<label>`
- Required fields are clearly indicated
- Validation errors are tied to fields (`aria-describedby`)
- Keyboard-only users can complete the form
- No focus movement on initial load

**UX Tone:**
Calm, forgiving, predictable.

[PASTE GLOBAL PROMPT FOOTER FROM SECTION 10]
```

---

## Appendix C: Component Generation Prompt

```
Generate a Svelte component for the following UI.

**Purpose:**
[One-sentence description]

**User:**
A non-technical, potentially stressed church admin.

**Requirements:**
- Semantic HTML only
- Native browser behavior by default
- Full keyboard usability
- Visible focus styles
- No auto-focus on load
- Calm, obvious UI (no visual gimmicks)

**Framework Context:**
- SvelteKit
- Tailwind allowed
- No third-party UI abstractions unless unavoidable

[PASTE GLOBAL PROMPT FOOTER FROM SECTION 10]
```

---

<!-- EXTRACTION MARKERS FOR TOOL-SPECIFIC FILES -->
<!-- 
  To generate tool-specific files:
  
  CLAUDE.md: Include sections 1-14, full detail
  GEMINI.md: Include sections 1-8, 12-14, summarize 9-11
  copilot-instructions.md: Include sections 9-11 in full, summarize 1-8
-->
