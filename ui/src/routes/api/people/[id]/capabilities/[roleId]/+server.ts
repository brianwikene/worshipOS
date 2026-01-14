// src/routes/api/people/[id]/capabilities/[roleId]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// DELETE - Remove a role capability from a person
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const personId = event.params.id;
  const roleId = event.params.roleId;

  try {
    const { data, error: delError } = await event.locals.supabase
      .from('person_role_capabilities')
      .delete()
      .eq('church_id', churchId)
      .eq('person_id', personId)
      .eq('role_id', roleId)
      .select('id')
      .maybeSingle();

    if (delError) throw delError;

    if (!data) {
      throw error(404, 'Capability not found');
    }

    return json({ success: true });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/people/[id]/capabilities/[roleId] DELETE', err);
    throw error(500, err.message || 'Database error');
  }
};

// PATCH - Update a role capability (proficiency, primary status, etc.)
export const PATCH: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const personId = event.params.id;
  const roleId = event.params.roleId;
  const body = await event.request.json().catch(() => ({}));
  const { proficiency, is_primary, is_approved, notes } = body;

  try {
    // If setting as primary, unset other primaries first
    if (is_primary === true) {
      const { error: resetError } = await event.locals.supabase
        .from('person_role_capabilities')
        .update({ is_primary: false })
        .eq('church_id', churchId)
        .eq('person_id', personId);

      if (resetError) throw resetError;
    }

    const updates: Record<string, any> = {};
    if (proficiency !== undefined) updates.proficiency = proficiency;
    if (is_primary !== undefined) updates.is_primary = is_primary;
    if (is_approved !== undefined) updates.is_approved = is_approved;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      throw error(400, 'No fields to update');
    }

    const { data: updated, error: updateError } = await event.locals.supabase
      .from('person_role_capabilities')
      .update(updates)
      .eq('church_id', churchId)
      .eq('person_id', personId)
      .eq('role_id', roleId)
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      throw error(404, 'Capability not found');
    }

    return json({ success: true });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/people/[id]/capabilities/[roleId] PATCH', err);
    throw error(500, err.message || 'Database error');
  }
};
