// /ui/src/routes/api/gatherings/[id]/assignments/[assignmentId]/+server.ts
// src/routes/api/gatherings/[id]/assignments/[assignmentId]/+server.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function assertAssignmentInChurch(
    supabase: SupabaseClient,
  assignmentId: string,
  instanceId: string,
  churchId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('service_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('id', assignmentId)
    .eq('service_instance_id', instanceId)
    .eq('church_id', churchId);

  return (count ?? 0) > 0;
}

// Check for body part conflicts when assigning a person to a role
async function checkBodyPartConflicts(
  supabase: SupabaseClient,
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
  const { data: roleRow } = await supabase
    .from('roles')
    .select('name, body_parts')
    .eq('id', roleId)
    .eq('church_id', churchId)
    .single();

  if (!roleRow) {
    return { hasConflict: false, conflicts: [] };
  }

  const roleBodyParts: string[] = roleRow.body_parts || [];

  if (roleBodyParts.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  // Get all other assignments for this person in this service instance
  const { data: existingAssignments } = await supabase
    .from('service_assignments')
    .select(`
        id, role:roles(name, body_parts)
    `)
    .eq('service_instance_id', instanceId)
    .eq('person_id', personId)
    .eq('church_id', churchId)
    .neq('id', excludeAssignmentId); // Exclude self

  const conflicts: string[] = [];

  for (const existingAssignmentRow of (existingAssignments || [])) {
    const existingBodyParts: string[] = (existingAssignmentRow.role as any)?.body_parts || [];
    const overlap = roleBodyParts.filter(bp => existingBodyParts.includes(bp));

    if (overlap.length > 0) {
      conflicts.push(
        `${roleRow.name} (${overlap.join(', ')}) conflicts with ${(existingAssignmentRow.role as any)?.name}`
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
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId, assignmentId } = event.params;
  const body = await event.request.json();
  const { person_id, status, is_lead, notes, force = false } = body;

  const assignmentBelongsToChurch = await assertAssignmentInChurch(event.locals.supabase, assignmentId, instanceId, churchId);
  if (!assignmentBelongsToChurch) {
    throw error(404, 'Assignment not found');
  }

  // Get current assignment to know the role_id
  const { data: currentAssignment } = await event.locals.supabase
    .from('service_assignments')
    .select('role_id')
    .eq('id', assignmentId)
    .single();

  if (!currentAssignment) {
    throw error(404, 'Assignment not found');
  }

  const roleId = currentAssignment.role_id;

  // Check for body part conflicts if assigning a person
  if (person_id && !force) {
    const conflictCheck = await checkBodyPartConflicts(
      event.locals.supabase,
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
  const updates: Record<string, any> = {};

  if (person_id !== undefined) updates.person_id = person_id || null;
  if (status !== undefined) updates.status = status;
  if (is_lead !== undefined) updates.is_lead = is_lead;
  if (notes !== undefined) updates.notes = notes || null;

  if (Object.keys(updates).length === 0) {
    throw error(400, 'No fields to update');
  }

  const { data: updatedAssignment, error: updateError } = await event.locals.supabase
    .from('service_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .eq('church_id', churchId)
    .select()
    .single();

  if (updateError) {
      console.error('PUT /api/gatherings/.../assignments/[id] failed:', updateError);
      throw error(500, 'Failed to update assignment');
  }

  return json(updatedAssignment);
};

// DELETE - Remove an assignment entirely
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId, assignmentId } = event.params;

  const ok = await assertAssignmentInChurch(event.locals.supabase, assignmentId, instanceId, churchId);
  if (!ok) {
    throw error(404, 'Assignment not found');
  }

  const { error: dbError } = await event.locals.supabase
    .from('service_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('church_id', churchId);

  if (dbError) {
      console.error('DELETE /api/gatherings/.../assignments/[id] failed:', dbError);
      throw error(500, 'Failed to delete assignment');
  }

  return json({ success: true });
};
