// src/routes/api/contexts/[id]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// GET - Get a single context with its role requirements
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `SELECT id, name, description, is_active
     FROM contexts
     WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Service type not found');
  }

  // Get role requirements
  const reqResult = await pool.query(
    `SELECT
      srr.role_id,
      r.name AS role_name,
      r.ministry_area,
      srr.min_needed,
      srr.max_needed,
      srr.display_order
     FROM service_role_requirements srr
     JOIN roles r ON r.id = srr.role_id
     WHERE srr.context_id = $1 AND srr.church_id = $2
     ORDER BY srr.display_order, r.ministry_area NULLS LAST, r.name`,
    [id, churchId]
  );

  return json({
    ...result.rows[0],
    role_requirements: reqResult.rows
  });
};

// PUT - Update a context
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;
  const body = await event.request.json();
  const { name, description, is_active, role_requirements } = body;

  // Check context exists
  const existing = await pool.query(
    'SELECT id FROM contexts WHERE id = $1 AND church_id = $2',
    [id, churchId]
  );

  if (existing.rows.length === 0) {
    throw error(404, 'Service type not found');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update context fields if provided
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      // Check for duplicate name
      const duplicate = await client.query(
        'SELECT id FROM contexts WHERE church_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [churchId, name.trim(), id]
      );
      if (duplicate.rows.length > 0) {
        throw error(409, 'A service type with this name already exists');
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length > 0) {
      values.push(id, churchId);
      await client.query(
        `UPDATE contexts SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND church_id = $${paramIndex}`,
        values
      );
    }

    // Update role requirements if provided
    if (role_requirements !== undefined) {
      // Delete existing requirements
      await client.query(
        'DELETE FROM service_role_requirements WHERE context_id = $1 AND church_id = $2',
        [id, churchId]
      );

      // Insert new requirements
      for (let i = 0; i < role_requirements.length; i++) {
        const req = role_requirements[i];
        await client.query(
          `INSERT INTO service_role_requirements
           (church_id, context_id, role_id, min_needed, max_needed, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [churchId, id, req.role_id, req.min_needed || 1, req.max_needed || null, i]
        );
      }
    }

    await client.query('COMMIT');

    // Return updated context
    const updated = await pool.query(
      'SELECT id, name, description, is_active FROM contexts WHERE id = $1',
      [id]
    );

    const reqResult = await pool.query(
      `SELECT
        srr.role_id,
        r.name AS role_name,
        r.ministry_area,
        srr.min_needed,
        srr.max_needed,
        srr.display_order
       FROM service_role_requirements srr
       JOIN roles r ON r.id = srr.role_id
       WHERE srr.context_id = $1 AND srr.church_id = $2
       ORDER BY srr.display_order`,
      [id, churchId]
    );

    return json({
      ...updated.rows[0],
      role_requirements: reqResult.rows
    });

  } catch (e: any) {
    await client.query('ROLLBACK');
    if (e.status) throw e; // Re-throw SvelteKit errors
    console.error('Error updating context:', e);
    throw error(500, e.message || 'Failed to update service type');
  } finally {
    client.release();
  }
};

// DELETE - Soft delete a context
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `UPDATE contexts SET is_active = false WHERE id = $1 AND church_id = $2 RETURNING id`,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Service type not found');
  }

  return json({ success: true });
};
