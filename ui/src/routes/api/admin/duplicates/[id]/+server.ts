// src/routes/api/admin/duplicates/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/admin/duplicates/:id
export const GET: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = params;

  const { data, error: dbError } = await locals.supabase
    .from('identity_links')
    .select(`
        *,
        person_a:people!person_a_id(display_name),
        person_b:people!person_b_id(display_name),
        reviewer:people!reviewed_by(display_name)
    `)
    .eq('id', id)
    .eq('church_id', churchId)
    .single();

  if (dbError) {
      if (dbError.code === 'PGRST116') throw error(404, 'Identity link not found');
      console.error('GET duplicate failed:', dbError);
      throw error(500, 'Failed to load identity link');
  }

  // Flatten for UI consistency
  const result = {
      ...data,
      person_a_display_name: data.person_a?.display_name,
      person_b_display_name: data.person_b?.display_name,
      reviewer_name: data.reviewer?.display_name
  };

  return json(result);
};

// PUT /api/admin/duplicates/:id
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = params;
  const body = await request.json();
  const { status, review_notes, suppress_duration_days } = body;

  const validStatuses = ['suggested', 'confirmed', 'not_match'];
  if (status && !validStatuses.includes(status)) {
    throw error(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const updates: any = {};
  if (status) {
      updates.status = status;
      updates.reviewed_at = new Date().toISOString();
      // updates.reviewed_by = userId; // TODO: Get from session
  }
  if (review_notes !== undefined) {
      updates.review_notes = review_notes || null;
  }
  if (status === 'not_match') {
      const days = suppress_duration_days || 365;
      const suppressedUntil = new Date();
      suppressedUntil.setDate(suppressedUntil.getDate() + days);
      updates.suppressed_until = suppressedUntil.toISOString();
  }

  if (Object.keys(updates).length === 0) {
      throw error(400, 'No valid fields to update');
  }

  const { data, error: updateError } = await locals.supabase
    .from('identity_links')
    .update(updates)
    .eq('id', id)
    .eq('church_id', churchId)
    .select()
    .single();

  if (updateError) {
      console.error('PUT duplicate failed:', updateError);
      throw error(500, 'Failed to update identity link');
  }

  return json(data);
};

// DELETE /api/admin/duplicates/:id
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = params;

  // Only allow deletion of 'suggested' links
  const { data, error: deleteError } = await locals.supabase
    .from('identity_links')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId)
    .eq('status', 'suggested')
    .select('id')
    .single();

  if (deleteError) {
      console.error('DELETE duplicate failed:', deleteError);
      throw error(500, 'Failed to delete identity link');
  }

  // Note: If no row matched (e.g. status != suggested), Supabase delete returns null data/error if using maybeSingle or check count.
  // .single() throws if 0 rows.
  // So catching error might be enough if it returns row.

  return json({ success: true, deleted_id: id });
};
