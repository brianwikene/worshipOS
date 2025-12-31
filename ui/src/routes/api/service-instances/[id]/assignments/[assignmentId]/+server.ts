// src/routes/api/service-instances/[id]/assignments/[assignmentId]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

async function assertAssignmentInChurch(
  assignmentId: string,
  instanceId: string,
  churchId: string
): Promise<boolean> {
  const check = await pool.query(
    `SELECT 1
     FROM service_assignments sa
     WHERE sa.id = $1
       AND sa.service_instance_id = $2
       AND sa.church_id = $3`,
    [assignmentId, instanceId, churchId]
  );
  return (check.rowCount ?? 0) > 0;
}

// Check for body part conflicts when assigning a person to a role
async function checkBodyPartConflicts(
  churchId: string,
  instanceId: string,
  personId: string | null,
  roleId: string,
  excludeAssignmentId: string
): Promise<{ hasConflict: boolean; conflicts: string[] }> {
  if (!personId) {
    return { hasConflict: false, conflicts: [] };
  }

  // Get body parts for the role being assigned
  const roleResult = await pool.query(
    'SELECT name, body_parts FROM roles WHERE id = $1 AND church_id = $2',
    [roleId, churchId]
  );

  if (roleResult.rows.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  const role = roleResult.rows[0];
  const roleBodyParts: string[] = role.body_parts || [];

  if (roleBodyParts.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  // Get all other assignments for this person in this service instance
  const existingResult = await pool.query(
    `SELECT sa.id, r.name, r.body_parts
     FROM service_assignments sa
     JOIN roles r ON r.id = sa.role_id
     WHERE sa.service_instance_id = $1
       AND sa.person_id = $2
       AND sa.church_id = $3
       AND sa.id != $4`,
    [instanceId, personId, churchId, excludeAssignmentId]
  );

  const conflicts: string[] = [];

  for (const existing of existingResult.rows) {
    const existingBodyParts: string[] = existing.body_parts || [];
    const overlap = roleBodyParts.filter(bp => existingBodyParts.includes(bp));

    if (overlap.length > 0) {
      conflicts.push(
        `${role.name} (${overlap.join(', ')}) conflicts with ${existing.name}`
      );
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

// PUT - Update an assignment (assign/change person, update status)
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId, assignmentId } = event.params;
  const body = await event.request.json();
  const { person_id, status, is_lead, notes, force = false } = body;

  const ok = await assertAssignmentInChurch(assignmentId, instanceId, churchId);
  if (!ok) {
    throw error(404, 'Assignment not found');
  }

  // Get current assignment to know the role_id
  const currentResult = await pool.query(
    'SELECT role_id FROM service_assignments WHERE id = $1',
    [assignmentId]
  );

  if (currentResult.rows.length === 0) {
    throw error(404, 'Assignment not found');
  }

  const roleId = currentResult.rows[0].role_id;

  // Check for body part conflicts if assigning a person
  if (person_id && !force) {
    const conflictCheck = await checkBodyPartConflicts(
      churchId,
      instanceId,
      person_id,
      roleId,
      assignmentId
    );

    if (conflictCheck.hasConflict) {
      throw error(409, JSON.stringify({
        code: 'BODY_PART_CONFLICT',
        message: 'This person is already assigned to a role that uses the same body parts',
        conflicts: conflictCheck.conflicts
      }));
    }
  }

  // Build dynamic update
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (person_id !== undefined) {
    updates.push(`person_id = $${paramIndex++}`);
    values.push(person_id || null);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(status);
  }
  if (is_lead !== undefined) {
    updates.push(`is_lead = $${paramIndex++}`);
    values.push(is_lead);
  }
  if (notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`);
    values.push(notes || null);
  }

  if (updates.length === 0) {
    throw error(400, 'No fields to update');
  }

  values.push(assignmentId, churchId);

  const result = await pool.query(
    `UPDATE service_assignments
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex++} AND church_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return json(result.rows[0]);
};

// DELETE - Remove an assignment entirely
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId, assignmentId } = event.params;

  const ok = await assertAssignmentInChurch(assignmentId, instanceId, churchId);
  if (!ok) {
    throw error(404, 'Assignment not found');
  }

  await pool.query(
    'DELETE FROM service_assignments WHERE id = $1 AND church_id = $2',
    [assignmentId, churchId]
  );

  return json({ success: true });
};
