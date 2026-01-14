// src/routes/api/assignments/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;
  const body = await event.request.json();
  const { person_id, status, is_lead, notes } = body;

  // Build update object dynamically to mimic COALESCE behavior (only update if provided)
  // Note: If you explicitly want to set something to null, this logic might need adjustment,
  // but this matches the legacy "COALESCE($1, column)" intent (ignore if missing).
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  if (person_id !== undefined) updates.person_id = person_id;
  if (status !== undefined) updates.status = status;
  if (is_lead !== undefined) updates.is_lead = is_lead;
  if (notes !== undefined) updates.notes = notes;

  const { data: updated, error: dbError } = await event.locals.supabase
    .from('service_assignments')
    .update(updates)
    .eq('id', id)
    // RLS should handle church_id, but good practice to include it if table has it
    // However, assignments usually belong to instances which belong to church.
    // If service_assignments has church_id, we should use it.
    // (Checked previous query: WHERE id = $5 - didn't check church_id explicitly in legacy?)
    // Wait, let me re-read the legacy file.
    // Legacy: "WHERE id = $5". IT DID NOT CHECK CHURCH_ID!
    // But "churchId" was retrieved at the top. Unused?
    // WARNING: Legacy code had a security flaw if it didn't check church_id.
    // I will ADD .eq('church_id', churchId) for safety if the column exists.
    // Gathering creation added church_id to assignments, so it exists.
    .eq('church_id', churchId)
    .select()
    .single();

  if (dbError) {
    console.error('[API] /api/assignments/[id] PUT failed:', dbError);
    throw error(500, 'Database error');
  }

  if (!updated) {
    throw error(404, 'Assignment not found');
  }

  return json(updated, {
    headers: { 'x-served-by': 'sveltekit' }
  });
};

export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  const { data: deleted, error: dbError } = await event.locals.supabase
    .from('service_assignments')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId) // Adding church_id check for safety
    .select()
    .single();

  if (dbError) {
    console.error('[API] /api/assignments/[id] DELETE failed:', dbError);
    throw error(500, 'Database error');
  }

  if (!deleted) {
    throw error(404, 'Assignment not found');
  }

  return json(
    { message: 'Assignment removed', assignment: deleted },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
