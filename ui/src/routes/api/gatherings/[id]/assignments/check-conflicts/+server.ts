// src/routes/api/gatherings/[id]/assignments/check-conflicts/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Check for body part conflicts before assigning
// Query params: person_id, role_id
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId } = event.params;
  const personId = event.url.searchParams.get('person_id');
  const roleId = event.url.searchParams.get('role_id');

  if (!personId || !roleId) {
    throw error(400, 'person_id and role_id are required');
  }

  // Get body parts for the new role
  const { data: newRoleRow } = await event.locals.supabase
    .from('roles')
    .select('name, body_parts')
    .eq('id', roleId)
    .eq('church_id', churchId)
    .single();

  if (!newRoleRow) {
    throw error(404, 'Role not found');
  }

  const newBodyParts: string[] = newRoleRow.body_parts || [];

  // If the new role doesn't require any body parts, no conflict possible
  if (newBodyParts.length === 0) {
    return json({
      hasConflict: false,
      conflicts: [],
      newRole: {
         name: newRoleRow.name,
         body_parts: []
      }
    });
  }

  // Get all existing assignments for this person in this service instance
  const { data: existingAssignments } = await event.locals.supabase
    .from('service_assignments')
    .select(`
        role:roles(name, body_parts)
    `)
    .eq('service_instance_id', instanceId)
    .eq('person_id', personId)
    .eq('church_id', churchId);

  const conflicts: Array<{
    existingRole: string;
    newRole: string;
    overlappingParts: string[];
  }> = [];

  const flattenedAssignments = (existingAssignments || []).map((a: any) => ({
      role: a.role?.name,
      body_parts: a.role?.body_parts || []
  }));

  for (const existing of flattenedAssignments) {
    const existingBodyParts: string[] = existing.body_parts || [];

    // Check for overlapping body parts
    const overlap = newBodyParts.filter(bp => existingBodyParts.includes(bp));

    if (overlap.length > 0) {
      conflicts.push({
        existingRole: existing.role,
        newRole: newRoleRow.name,
        overlappingParts: overlap
      });
    }
  }

  return json({
     hasConflict: conflicts.length > 0,
     conflicts,
     newRole: {
       name: newRoleRow.name,
       body_parts: newBodyParts
     },
     existingAssignments: flattenedAssignments
  });
};
