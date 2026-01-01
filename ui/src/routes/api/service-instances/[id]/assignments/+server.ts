// src/routes/api/service-instances/[id]/assignments/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

async function assertInstanceInChurch(instanceId: string, churchId: string): Promise<boolean> {
  const check = await pool.query(
    `
    SELECT 1
    FROM service_instances si
    JOIN service_groups sg ON sg.id = si.service_group_id
    WHERE si.id = $1 AND sg.church_id = $2
    `,
    [instanceId, churchId]
  );
  return (check.rowCount ?? 0) > 0;
}

// Check for body part conflicts when assigning a person to a role
async function checkBodyPartConflicts(
  churchId: string,
  instanceId: string,
  personId: string | null,
  newRoleId: string
): Promise<{ hasConflict: boolean; conflicts: string[] }> {
  if (!personId) {
    return { hasConflict: false, conflicts: [] };
  }

  // Get body parts for the new role
  const newRoleResult = await pool.query(
    'SELECT name, body_parts FROM roles WHERE id = $1 AND church_id = $2',
    [newRoleId, churchId]
  );

  if (newRoleResult.rows.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  const newRole = newRoleResult.rows[0];
  const newBodyParts: string[] = newRole.body_parts || [];

  // If the new role doesn't require any body parts, no conflict possible
  if (newBodyParts.length === 0) {
    return { hasConflict: false, conflicts: [] };
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

  const conflicts: string[] = [];

  for (const existing of existingResult.rows) {
    const existingBodyParts: string[] = existing.body_parts || [];

    // Check for overlapping body parts
    const overlap = newBodyParts.filter(bp => existingBodyParts.includes(bp));

    if (overlap.length > 0) {
      conflicts.push(
        `${newRole.name} (${overlap.join(', ')}) conflicts with ${existing.name}`
      );
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId } = event.params;
  const body = await event.request.json();
  const { role_id, person_id, status, is_lead, notes, force = false } = body;

  if (!role_id) {
    throw error(400, 'role_id is required');
  }

  const ok = await assertInstanceInChurch(instanceId, churchId);
  if (!ok) {
    throw error(404, 'Service instance not found');
  }

  // Check for body part conflicts (unless force=true to override)
  if (person_id && !force) {
    const conflictCheck = await checkBodyPartConflicts(churchId, instanceId, person_id, role_id);

    if (conflictCheck.hasConflict) {
      throw error(409, JSON.stringify({
        code: 'BODY_PART_CONFLICT',
        message: 'This person is already assigned to a role that uses the same body parts',
        conflicts: conflictCheck.conflicts
      }));
    }
  }

  const result = await pool.query(
    `INSERT INTO service_assignments
      (church_id, service_instance_id, role_id, person_id, status, is_lead, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      churchId,
      instanceId,
      role_id,
      person_id,
      status || 'pending',
      is_lead || false,
      notes
    ]
  );

  return json(result.rows[0], {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};
