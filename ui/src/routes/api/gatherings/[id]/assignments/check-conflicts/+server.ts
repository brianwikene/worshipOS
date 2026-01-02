// src/routes/api/gatherings/[id]/assignments/check-conflicts/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// GET - Check for body part conflicts before assigning
// Query params: person_id, role_id
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId } = event.params;
  const personId = event.url.searchParams.get('person_id');
  const roleId = event.url.searchParams.get('role_id');

  if (!personId || !roleId) {
    throw error(400, 'person_id and role_id are required');
  }

  // Get body parts for the new role
  const newRoleResult = await pool.query(
    'SELECT name, body_parts FROM roles WHERE id = $1 AND church_id = $2',
    [roleId, churchId]
  );

  if (newRoleResult.rows.length === 0) {
    throw error(404, 'Role not found');
  }

  const newRole = newRoleResult.rows[0];
  const newBodyParts: string[] = newRole.body_parts || [];

  // If the new role doesn't require any body parts, no conflict possible
  if (newBodyParts.length === 0) {
    return json({
      hasConflict: false,
      conflicts: [],
      newRole: {
        name: newRole.name,
        body_parts: []
      }
    });
  }

  // Get all existing assignments for this person in this service instance
  const existingResult = await pool.query(
    `SELECT r.name, r.body_parts
     FROM service_assignments sa
     JOIN roles r ON r.id = sa.role_id
     WHERE sa.service_instance_id = $1
       AND sa.person_id = $2
       AND sa.church_id = $3`,
    [instanceId, personId, churchId]
  );

  const conflicts: Array<{
    existingRole: string;
    newRole: string;
    overlappingParts: string[];
  }> = [];

  for (const existing of existingResult.rows) {
    const existingBodyParts: string[] = existing.body_parts || [];

    // Check for overlapping body parts
    const overlap = newBodyParts.filter(bp => existingBodyParts.includes(bp));

    if (overlap.length > 0) {
      conflicts.push({
        existingRole: existing.name,
        newRole: newRole.name,
        overlappingParts: overlap
      });
    }
  }

  return json({
    hasConflict: conflicts.length > 0,
    conflicts,
    newRole: {
      name: newRole.name,
      body_parts: newBodyParts
    },
    existingAssignments: existingResult.rows.map(r => ({
      role: r.name,
      body_parts: r.body_parts || []
    }))
  });
};
