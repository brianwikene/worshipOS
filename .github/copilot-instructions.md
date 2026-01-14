# GitHub Copilot Instructions — WorshipOS

> **Source of truth:** See `AGENTS.md` in the project root for the complete instruction set.
> This file emphasizes accessibility and UI generation rules for Copilot.

---

## Project Context

WorshipOS is a SvelteKit worship planning platform for churches. We prioritize **soul care over logistics**.

- **Database**: PostgreSQL via Supabase
- **Styling**: Tailwind CSS + `sys-*` system classes
- **Philosophy**: Calm interfaces, semantic HTML, accessibility-first

### Constitutional Document
`docs/Guidebook-4.md` is the source of truth. All features must align with its principles:
- Trust is the primary feature
- The Calm Interface Mandate (reduce cognitive load, never shame)
- Archive, don't delete

---

## Accessibility Rules (MANDATORY)

WorshipOS treats accessibility as a **first-class feature**. All generated code must conform.

### 1. Semantic HTML First (No Exceptions)

Use native elements:
- `<button>` for buttons
- `<a>` for links
- `<input>`, `<textarea>`, `<select>` for form controls

**Do NOT** use `<div>` or `<span>` for interactive behavior. ARIA is a fallback, not a shortcut.

### 2. Interactive Elements Contract

Any interactive element MUST:
- Be reachable via keyboard (Tab)
- Activate via Enter/Space when appropriate
- Have a visible focus state
- Expose correct semantics to screen readers

### 3. Forms & Labels Are Non-Negotiable

- Every `<label>` MUST be associated with a control
- Acceptable: `<label for="id">` or wrapping the control inside `<label>`
- **Placeholder text is NOT a label**

### 4. Focus Behavior

- Focus must always be visible
- **No focus on page load**
- Focus moves only for: dialogs, explicit user action, error correction

### 5. No Warning Suppression

- **Never** use `svelte-ignore` or `eslint-disable` for a11y warnings
- Warnings indicate architectural drift—resolve at source

### 6. Definition of Done

A change is NOT complete unless:
- `npm run dev` emits **zero** Svelte a11y warnings
- Keyboard navigation works
- Screen reader semantics are correct

---

## AI Code Rule

If AI-generated UI code violates accessibility rules:
- **Regenerate** — Do not patch structural mistakes
- The prompt is wrong, not the review process

---

## UI Conventions

### Tables
- Tables are interaction surfaces
- Every row has a leading visual anchor (Avatar for people, ObjectMark for songs)
- Row actions are visually secondary (`sys-icon-btn--ghost`)

### Consistency
- Reuse `sys-*` classes and existing components
- Do not invent new icon systems
- Add `type="button"` to buttons inside table rows
- Preserve ARIA labels and keyboard behavior

### When Editing Routes
- Keep changes local unless shared across pages
- Shared styles go in `ui/src/app.css` using existing tokens

---

## Quick Architecture Reference

### Domain Language

| Public/API | Database (Legacy) |
|------------|-------------------|
| Gathering | service_instances |
| gathering_id | service_instance_id |

**API and UI must use "gatherings"**. Do not expose `service_*` names.

### Database Access
Use Supabase client (not legacy `pg` pool):
```typescript
const { data } = await locals.supabase
  .from('table_name')
  .select('*')
  .eq('church_id', locals.churchId);
```

### Multi-Tenancy
- `church_id` on all tables
- `X-Church-Id` header required
- Access via `event.locals.churchId`

### TEND / CARE Boundary
> TEND notices. CARE responds.

- TEND: Lens (signals, dashboards). Never stores narratives.
- CARE: Container (cases, notes). RLS-protected.
- One-way handoff from TEND → CARE only.

---

## Key Constraints

1. Do not rename DB tables without `DB_MIGRATION_PLAN.md`
2. Prefer editing existing files over creating new ones
3. Use shared `sys-*` components
4. All features must align with `docs/Guidebook-4.md`
5. **Accessibility is non-negotiable**

---

## Global Prompt Footer (Include in UI Requests)

When requesting UI generation, append:

> **WorshipOS Accessibility Baseline:**
> - Semantic HTML only (`button`, `a`, `label`, `input`)
> - No div/span as interactive elements
> - No `role="button"` or `tabindex` hacks
> - Keyboard navigation must work
> - Focus visible and predictable
> - No focus on page load
> - Inputs must have real labels
> - ARIA only when semantic HTML cannot express intent
