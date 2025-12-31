// src/routes/api/teams/[id]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// GET - Get a single team with its roles
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `SELECT id, name, description, color, icon, is_active, display_order
     FROM teams
     WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Team not found');
  }

  // Get roles for this team
  const rolesResult = await pool.query(
    `SELECT id, name, description, body_parts, load_weight, is_active
     FROM roles
     WHERE team_id = $1 AND church_id = $2
     ORDER BY name`,
    [id, churchId]
  );

  return json({
    ...result.rows[0],
    roles: rolesResult.rows
  });
};

// PUT - Update a team
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;
  const body = await event.request.json();
  const { name, description, color, icon, is_active, display_order } = body;

  // Check team exists
  const existing = await pool.query(
    'SELECT id FROM teams WHERE id = $1 AND church_id = $2',
    [id, churchId]
  );

  if (existing.rows.length === 0) {
    throw error(404, 'Team not found');
  }

  // Check for duplicate name
  if (name) {
    const duplicate = await pool.query(
      'SELECT id FROM teams WHERE church_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
      [churchId, name.trim(), id]
    );
    if (duplicate.rows.length > 0) {
      throw error(409, 'A team with this name already exists');
    }
  }

  // Build dynamic update
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(description || null);
  }
  if (color !== undefined) {
    updates.push(`color = $${paramIndex++}`);
    values.push(color);
  }
  if (icon !== undefined) {
    updates.push(`icon = $${paramIndex++}`);
    values.push(icon);
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(is_active);
  }
  if (display_order !== undefined) {
    updates.push(`display_order = $${paramIndex++}`);
    values.push(display_order);
  }

  if (updates.length === 0) {
    throw error(400, 'No fields to update');
  }

  values.push(id, churchId);

  const result = await pool.query(
    `UPDATE teams SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND church_id = $${paramIndex}
     RETURNING id, name, description, color, icon, is_active, display_order`,
    values
  );

  return json(result.rows[0]);
};

// DELETE - Soft delete a team (roles become unassigned)
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  // Check how many roles are in this team
  const rolesCount = await pool.query(
    'SELECT COUNT(*) as count FROM roles WHERE team_id = $1 AND church_id = $2',
    [id, churchId]
  );

  // Soft delete the team
  const result = await pool.query(
    `UPDATE teams SET is_active = false WHERE id = $1 AND church_id = $2 RETURNING id`,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Team not found');
  }

  // Unassign roles from this team
  await pool.query(
    'UPDATE roles SET team_id = NULL WHERE team_id = $1 AND church_id = $2',
    [id, churchId]
  );

  return json({
    success: true,
    roles_unassigned: parseInt(rolesCount.rows[0].count)
  });
};
