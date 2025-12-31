// src/routes/api/people/[id]/capabilities/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// GET - List all role capabilities for a person
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const personId = event.params.id;

  const result = await pool.query(
    `SELECT
      prc.id,
      prc.role_id,
      r.name AS role_name,
      r.ministry_area,
      r.body_parts,
      prc.proficiency,
      prc.is_primary,
      prc.is_approved,
      prc.notes
    FROM person_role_capabilities prc
    JOIN roles r ON r.id = prc.role_id
    WHERE prc.church_id = $1 AND prc.person_id = $2
    ORDER BY prc.is_primary DESC, r.ministry_area NULLS LAST, r.name`,
    [churchId, personId]
  );

  return json(result.rows);
};

// POST - Add a role capability to a person
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const personId = event.params.id;
  const body = await event.request.json();
  const { role_id, proficiency = 3, is_primary = false, notes = null } = body;

  if (!role_id) {
    throw error(400, 'role_id is required');
  }

  // Verify the role exists and belongs to this church
  const roleCheck = await pool.query(
    'SELECT id FROM roles WHERE id = $1 AND church_id = $2',
    [role_id, churchId]
  );

  if (roleCheck.rows.length === 0) {
    throw error(404, 'Role not found');
  }

  // Check if already exists
  const existing = await pool.query(
    'SELECT id FROM person_role_capabilities WHERE church_id = $1 AND person_id = $2 AND role_id = $3',
    [churchId, personId, role_id]
  );

  if (existing.rows.length > 0) {
    throw error(409, 'Person already has this role capability');
  }

  // If setting as primary, unset other primaries first
  if (is_primary) {
    await pool.query(
      'UPDATE person_role_capabilities SET is_primary = false WHERE church_id = $1 AND person_id = $2',
      [churchId, personId]
    );
  }

  const result = await pool.query(
    `INSERT INTO person_role_capabilities
     (church_id, person_id, role_id, proficiency, is_primary, is_approved, notes)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     RETURNING id`,
    [churchId, personId, role_id, proficiency, is_primary, notes]
  );

  return json({ success: true, id: result.rows[0].id }, { status: 201 });
};
