// src/routes/api/families/[id]/members/[memberId]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**************************************************************
 * PUT /api/families/:id/members/:memberId
 * Update a family membership
 **************************************************************/
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  const supabase = locals.supabase;
  if (!churchId) throw error(400, 'church_id is required');

  const { id: familyId, memberId } = params;
  const body = await request.json();
  const { relationship, is_primary_contact, is_temporary, notes } = body;

  const updates: any = { updated_at: new Date().toISOString() };
  if (relationship !== undefined) updates.relationship = relationship;
  if (is_primary_contact !== undefined) updates.is_primary_contact = is_primary_contact;
  if (is_temporary !== undefined) updates.is_temporary = is_temporary;
  if (notes !== undefined) updates.notes = notes?.trim() || null;

  const { data, error: updateError } = await supabase
    .from('family_members')
    .update(updates)
    .eq('id', memberId)
    .eq('family_id', familyId)
    .eq('church_id', churchId)
    .select()
    .single();

  if (updateError) {
      console.error('PUT member failed:', updateError);
      throw error(500, 'Failed to update family member');
  }
  if (!data) throw error(404, 'Family member not found');

  return json(data, { headers: { 'x-served-by': 'sveltekit' } });
};

/**************************************************************
 * DELETE /api/families/:id/members/:memberId
 * Remove a person from a family (soft delete)
 **************************************************************/
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  const supabase = locals.supabase;
  if (!churchId) throw error(400, 'church_id is required');

  const { id: familyId, memberId } = params;

  const { data, error: updateError } = await supabase
    .from('family_members')
    .update({
        is_active: false,
        end_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        updated_at: new Date().toISOString()
    })
    .eq('id', memberId)
    .eq('family_id', familyId)
    .eq('church_id', churchId)
    .select('id, person_id')
    .single();

  if (updateError) {
      console.error('DELETE member failed:', updateError);
      throw error(500, 'Failed to remove family member');
  }
  if (!data) throw error(404, 'Family member not found');

  return json(
    { message: 'Member removed from family', member: data },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
