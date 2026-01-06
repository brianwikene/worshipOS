<!-- GitHub Copilot instructions tailored for contributors and AI agents -->

# Copilot / Agent Guide — worshipOS

Purpose: quick, actionable guidance for AI coding agents to be productive in this repo.

- **Big picture:** This is a small monorepo with a Node/Express API (api/) and a Svelte UI (ui/). Postgres is the primary DB with SQL migrations under `api/migrations/` and several raw SQL queries embedded in `api/index.js`.

- **Key files & folders:**

  - `api/index.js` — main API server, exposes endpoints (gatherings, people, families, roles, assignments, songs). Many SQL queries are inlined here and are the primary integration surface to the DB.
  - `api/migrations/` — ordered SQL files to create schema (apply in sequence).
  - `db/` — reference schema and seed SQL files.
  - `ui/` — Svelte frontend (Vite); the API CORS is set for `http://localhost:5173`.
  - `test-crud-api.sh`, `start.sh` — helpful local-run/test scripts at repo root.

- **Run & debug (local):**

  - API: `cd api && npm install && node index.js` (starts on port 3000).
  - UI: `cd ui && npm install && npm run dev` (Vite dev on port 5173).
  - DB migrations: run `psql` against your local Postgres using files in `api/migrations/` in numeric order (001*.., 002*.., ...). Example used in code hints:
    psql "postgres://worship:worship@127.0.0.1:5432/worshipos" -f api/migrations/001_extensions.sql

- **Database conventions & patterns:**

  - Postgres is used via `pg.Pool`. SQL is embedded directly in `api/index.js` (no ORM). Expect `json_agg` and `json_build_object` in queries.
  - Many endpoints accept `org_id` as the primary tenant identifier. Note: some code uses `church_id` (in `GET /gatherings`) — prefer `org_id` and verify parameter names when editing.

- **API patterns & expectations:**

  - Endpoints return JSON and often return full aggregated rows (group + gatherings + assignments). See `GET /gatherings` and `GET /gatherings/:id/roster` for examples of aggregation and joins.
  - Error handling includes explicit hints for missing DB relations/columns (see error branches in `api/index.js`) — keep these intact when modifying error behavior.

- **Common edits agents will make:**

  - Add new endpoints to `api/index.js` following the existing style: `app.METHOD(path, async (req,res)=>{ try{ const r=await pool.query(...); res.json(r.rows) } catch(err){...} })`.
  - When changing SQL, prefer minimal diffs: keep existing aliases and named columns (e.g., `group_id`, `instance_id`, `assignments`) to avoid b

  # Accessibility & UI Integrity Rules (MANDATORY)

WorshipOS treats accessibility as a first-class feature, not a post-hoc fix.

All code generated or modified by Copilot MUST follow these rules.

---

## 1. Semantic HTML First (No Exceptions)

- Use native elements whenever possible:
  - button → <button>
  - link → <a>
  - input → <input>, <textarea>, <select>
- Do NOT use <div> or <span> for interactive behavior unless there is a documented constraint.

ARIA is a fallback, not a shortcut.

---

## 2. Interactive Elements Contract

Any interactive element MUST:

- be reachable via keyboard (Tab)
- activate via Enter/Space when appropriate
- have a visible focus state
- expose correct semantics to screen readers

If a <div> is interactive, it MUST include:

- role
- tabindex="0"
- keyboard handlers

Prefer replacing it with a semantic element instead.

---

## 3. Forms & Labels Are Non-Negotiable

- Every <label> MUST be associated with a control.
- Acceptable patterns:
  - <label for="id"> + matching id
  - wrapping the control inside <label>

For custom Input/Textarea components:

- Forward `id`, `name`, `aria-*`, and `required` props to the native element.
- Never swallow accessibility attributes.

---

## 4. Scoped CSS Discipline

- Remove unused scoped CSS selectors immediately.
- Do NOT keep speculative or “maybe later” styles without a TODO comment.
- CSS in a component should reflect rendered markup exactly.

---

## 5. No Warning Suppression

- Do NOT use svelte-ignore, eslint-disable, or similar to silence warnings.
- Warnings indicate architectural drift and must be resolved at the source.

---

## 6. Standardization Over Local Fixes

When fixing:

- icons
- tables
- inputs
- sorting
- row indicators

Prefer shared components or patterns over per-page solutions.

Assume changes will be reused.

---

## 7. Definition of Done (Accessibility)

A change is NOT complete unless:

- `npm run dev` (or equivalent) emits ZERO Svelte a11y warnings
- keyboard navigation works
- screen reader semantics are correct by inspection

Copilot should proactively enforce these rules while generating code.

# WorshipOS Copilot Instructions

## UI philosophy: iconography + density

- Tables are interaction surfaces, not just layouts.
- People tables are relational/pastoral: identity anchors (Avatar), actions recede.
- Songs tables are operational/catalog: strong scanability, actions recede.

## Scanability rules (tables)

- Every table row must have a leading visual anchor in the first column:
  - People: Avatar (existing)
  - Songs: ObjectMark (existing) or a stable-width anchor element.
- Row actions must be visually secondary:
  - Prefer `sys-icon-btn--ghost` for non-destructive actions.
  - Destructive actions may also be ghosted but must retain danger emphasis on hover/focus.

## Consistency rules

- Reuse existing system classes (`sys-*`) and existing SVGs/components. Do not invent new icon systems.
- Prefer small, reversible diffs. Avoid redesigns unless explicitly requested.
- Preserve ARIA labels and keyboard behavior. Add `type="button"` to buttons inside rows.

## When editing routes

- Keep changes local to the target page unless a shared type/style is clearly reused across multiple pages.
- If adding shared styles, add them to `ui/src/app.css` using existing tokens/variables.
