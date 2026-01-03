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
