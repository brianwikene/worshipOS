// src/routes/api/roles/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  // Include inactive if requested (for admin views)
  const includeInactive = event.url.searchParams.get('include_inactive') === 'true';

  const result = await pool.query(
    `SELECT r.id, r.name, r.ministry_area, r.description, r.load_weight, r.body_parts, r.is_active,
            r.team_id, t.name as team_name, t.color as team_color, t.icon as team_icon
     FROM roles r
     LEFT JOIN teams t ON t.id = r.team_id
     WHERE r.church_id = $1 ${includeInactive ? '' : 'AND r.is_active = true'}
     ORDER BY t.display_order NULLS LAST, t.name NULLS LAST, r.name`,
    [churchId]
  );

  return json(result.rows);
};

// POST - Create a new role
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const body = await event.request.json();
  const { name, team_id, ministry_area, description, load_weight = 10, body_parts = [] } = body;

  if (!name || name.trim() === '') {
    throw error(400, 'Role name is required');
  }

  // Check for duplicate name
  const existing = await pool.query(
    'SELECT id FROM roles WHERE church_id = $1 AND LOWER(name) = LOWER($2)',
    [churchId, name.trim()]
  );

  if (existing.rows.length > 0) {
    throw error(409, 'A role with this name already exists');
  }

  const result = await pool.query(
    `INSERT INTO roles (church_id, name, team_id, ministry_area, description, load_weight, body_parts)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, team_id, ministry_area, description, load_weight, body_parts, is_active`,
    [churchId, name.trim(), team_id || null, ministry_area || null, description || null, load_weight, body_parts]
  );

  return json(result.rows[0], { status: 201 });
};
