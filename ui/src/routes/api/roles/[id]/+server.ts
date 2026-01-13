// src/routes/api/roles/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Get a single role
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `SELECT r.id, r.name, r.team_id, r.ministry_area, r.description, r.load_weight, r.body_parts, r.is_active,
            t.name as team_name, t.color as team_color, t.icon as team_icon
     FROM roles r
     LEFT JOIN teams t ON t.id = r.team_id
     WHERE r.id = $1 AND r.church_id = $2`,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Role not found');
  }

  return json(result.rows[0]);
};

// PUT - Update a role
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;
  const body = await event.request.json();
  const { name, team_id, ministry_area, description, load_weight, body_parts, is_active } = body;

  // Check role exists
  const existing = await pool.query(
    'SELECT id FROM roles WHERE id = $1 AND church_id = $2',
    [id, churchId]
  );

  if (existing.rows.length === 0) {
    throw error(404, 'Role not found');
  }

  // Check for duplicate name (excluding current role)
  if (name) {
    const duplicate = await pool.query(
      'SELECT id FROM roles WHERE church_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
      [churchId, name.trim(), id]
    );

    if (duplicate.rows.length > 0) {
      throw error(409, 'A role with this name already exists');
    }
  }

  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name.trim());
  }
  if (team_id !== undefined) {
    updates.push(`team_id = $${paramIndex++}`);
    values.push(team_id || null);
  }
  if (ministry_area !== undefined) {
    updates.push(`ministry_area = $${paramIndex++}`);
    values.push(ministry_area || null);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(description || null);
  }
  if (load_weight !== undefined) {
    updates.push(`load_weight = $${paramIndex++}`);
    values.push(load_weight);
  }
  if (body_parts !== undefined) {
    updates.push(`body_parts = $${paramIndex++}`);
    values.push(body_parts);
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(is_active);
  }

  if (updates.length === 0) {
    throw error(400, 'No fields to update');
  }

  values.push(id, churchId);

  const result = await pool.query(
    `UPDATE roles
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex++} AND church_id = $${paramIndex}
     RETURNING id, name, team_id, ministry_area, description, load_weight, body_parts, is_active`,
    values
  );

  return json(result.rows[0]);
};

// DELETE - Soft delete (deactivate) a role
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  // Check if role is in use
  const inUse = await pool.query(
    `SELECT COUNT(*) as count FROM service_assignments WHERE role_id = $1 AND church_id = $2`,
    [id, churchId]
  );

  const usageCount = parseInt(inUse.rows[0].count);

  // Soft delete - just mark as inactive
  const result = await pool.query(
    `UPDATE roles SET is_active = false WHERE id = $1 AND church_id = $2 RETURNING id`,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Role not found');
  }

  return json({
    success: true,
    message: usageCount > 0
      ? `Role deactivated. It was used in ${usageCount} assignment(s).`
      : 'Role deactivated.'
  });
};
