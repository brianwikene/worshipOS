// src/routes/api/gatherings/[id]/assignments/+server.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function assertInstanceInChurch(supabase: SupabaseClient, instanceId: string, churchId: string): Promise<boolean> {
  const { count } = await supabase
      .from('service_instances')
      .select('id', { count: 'exact', head: true })
      .eq('id', instanceId)
      .eq('church_id', churchId);

  return (count ?? 0) > 0;
}

// Check for body part conflicts when assigning a person to a role
async function checkBodyPartConflicts(
  supabase: SupabaseClient,
  churchId: string,
  instanceId: string,
  personId: string | null,
  newRoleId: string
): Promise<{ hasConflict: boolean; conflicts: string[] }> {
  if (!personId) {
    return { hasConflict: false, conflicts: [] };
  }

  // Get body parts for the new role
  const { data: newRoleRow } = await supabase
    .from('roles')
    .select('name, body_parts')
    .eq('id', newRoleId)
    .eq('church_id', churchId)
    .single();

  if (!newRoleRow) {
    return { hasConflict: false, conflicts: [] };
  }

  const newBodyParts: string[] = newRoleRow.body_parts || [];

  if (newBodyParts.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  // Get all existing assignments for this person in this service instance
  const { data: existingAssignments } = await supabase
    .from('service_assignments')
    .select(`
        role:roles(name, body_parts)
    `)
    .eq('service_instance_id', instanceId)
    .eq('person_id', personId)
    .eq('church_id', churchId);

  const conflicts: string[] = [];

  for (const existingAssignmentRow of (existingAssignments || [])) {
    const role = existingAssignmentRow.role as any;
    if (!role) continue;

    const existingBodyParts: string[] = role.body_parts || [];

    const overlap = newBodyParts.filter(bp => existingBodyParts.includes(bp));

    if (overlap.length > 0) {
      conflicts.push(
        `${newRoleRow.name} (${overlap.join(', ')}) conflicts with ${role.name}`
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

  const instanceBelongsToChurch = await assertInstanceInChurch(event.locals.supabase, instanceId, churchId);
  if (!instanceBelongsToChurch) {
    throw error(404, 'Gathering instance not found');
  }

  // Check for body part conflicts (unless force=true to override)
  if (person_id && !force) {
    const conflictCheck = await checkBodyPartConflicts(event.locals.supabase, churchId, instanceId, person_id, role_id);

    if (conflictCheck.hasConflict) {
      throw error(409, JSON.stringify({
        code: 'BODY_PART_CONFLICT',
        message: 'This person is already assigned to a role that uses the same body parts',
        conflicts: conflictCheck.conflicts
      }));
    }
  }

  const { data: assignment, error: dbError } = await event.locals.supabase
    .from('service_assignments')
    .insert({
      church_id: churchId,
      service_instance_id: instanceId,
      role_id,
      person_id: person_id || null,
      status: status || 'pending',
      is_lead: is_lead || false,
      notes: notes || null
    })
    .select()
    .single();

  if (dbError) {
      console.error('POST /api/gatherings/[id]/assignments failed:', dbError);
      throw error(500, 'Failed to create assignment');
  }

  return json(assignment, {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};
