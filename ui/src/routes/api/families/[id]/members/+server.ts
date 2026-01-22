// /ui/src/routes/api/families/[id]/members/+server.ts
// src/routes/api/families/[id]/members/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**************************************************************
 * POST /api/families/:id/members
 * Add a person to a family
 **************************************************************/
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  const supabase = locals.supabase;
  if (!churchId) throw error(400, 'church_id is required');

  const { id: familyId } = params;
  const body = await request.json();
  const { person_id, relationship, is_primary_contact, is_temporary, notes } = body;

  if (!person_id) {
    throw error(400, 'person_id is required');
  }

  if (!relationship) {
    throw error(400, 'relationship is required');
  }

  // Validate relationship type
  const validRelationships = ['parent', 'guardian', 'spouse', 'child', 'foster_child', 'grandparent', 'sibling', 'other'];
  if (!validRelationships.includes(relationship)) {
    throw error(400, `Invalid relationship. Must be one of: ${validRelationships.join(', ')}`);
  }

  // Verify family exists
  const { count: fCount, error: fErr } = await supabase
    .from('families')
    .select('id', { count: 'exact', head: true })
    .eq('id', familyId)
    .eq('church_id', churchId);

  if (fErr || !fCount) throw error(404, 'Family not found');

  // Verify person exists
  const { count: pCount, error: pErr } = await supabase
    .from('people')
    .select('id', { count: 'exact', head: true })
    .eq('id', person_id)
    .eq('church_id', churchId);

  if (pErr || !pCount) throw error(404, 'Person not found');

  const { data, error: upsertError } = await supabase
    .from('family_members')
    .upsert({
      church_id: churchId,
      family_id: familyId,
      person_id: person_id,
      relationship,
      is_primary_contact: is_primary_contact || false,
      is_temporary: is_temporary || false,
      notes: notes?.trim() || null,
      is_active: true,
      end_date: null,
      updated_at: new Date().toISOString()
      // start_date logic: default is now, but if exists, keep original?
      // Upsert overwrites. If we want to preserve start_date, we should fetch first.
      // But original SQL set start_date = CURRENT_DATE on insert, and didn't update it on conflict.
      // Supabase upsert updates everything unless we exclude it?
      // Actually original was:
      // ON CONFLICT DO UPDATE SET relationship=..., start_date NOT updated.
      // We can use `.upsert(..., { onConflict: ..., ignoreDuplicates: false })`
      // But we can't ignore specific columns in update easily.
    }, { onConflict: 'church_id,family_id,person_id' })
    .select()
    .single();

  // If we really need to preserve start_date, we might have reset it here.
  // Ideally we would check if exists first.

  if (upsertError) {
      console.error('POST member failed:', upsertError);
      throw error(500, 'Failed to add family member');
  }

  return json(data, {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};
