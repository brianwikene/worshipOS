// src/routes/api/people/[id]/capabilities/[roleId]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// DELETE - Remove a role capability from a person
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const personId = event.params.id;
  const roleId = event.params.roleId;

  const result = await pool.query(
    `DELETE FROM person_role_capabilities
     WHERE church_id = $1 AND person_id = $2 AND role_id = $3
     RETURNING id`,
    [churchId, personId, roleId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Capability not found');
  }

  return json({ success: true });
};

// PATCH - Update a role capability (proficiency, primary status, etc.)
export const PATCH: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const personId = event.params.id;
  const roleId = event.params.roleId;
  const body = await event.request.json();
  const { proficiency, is_primary, is_approved, notes } = body;

  // If setting as primary, unset other primaries first
  if (is_primary === true) {
    await pool.query(
      'UPDATE person_role_capabilities SET is_primary = false WHERE church_id = $1 AND person_id = $2',
      [churchId, personId]
    );
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (proficiency !== undefined) {
    updates.push(`proficiency = $${paramIndex++}`);
    values.push(proficiency);
  }
  if (is_primary !== undefined) {
    updates.push(`is_primary = $${paramIndex++}`);
    values.push(is_primary);
  }
  if (is_approved !== undefined) {
    updates.push(`is_approved = $${paramIndex++}`);
    values.push(is_approved);
  }
  if (notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`);
    values.push(notes);
  }

  if (updates.length === 0) {
    throw error(400, 'No fields to update');
  }

  values.push(churchId, personId, roleId);

  const result = await pool.query(
    `UPDATE person_role_capabilities
     SET ${updates.join(', ')}
     WHERE church_id = $${paramIndex++} AND person_id = $${paramIndex++} AND role_id = $${paramIndex}
     RETURNING id`,
    values
  );

  if (result.rows.length === 0) {
    throw error(404, 'Capability not found');
  }

  return json({ success: true });
};
