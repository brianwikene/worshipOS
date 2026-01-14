// src/routes/api/addresses/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Get a single address
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    const { data: address, error: dbError } = await event.locals.supabase
      .from('addresses')
      .select('id, person_id, line1, line2, street, city, state, region, postal_code, country, label, lat, lng, timezone, created_at')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (dbError) {
      if (dbError.code === 'PGRST116') throw error(404, 'Address not found');
      throw dbError;
    }

    return json(address);
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/addresses/[id] GET', err);
    throw error(500, err.message || 'Database error');
  }
};

// PUT - Update an address
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;
  const body = await event.request.json().catch(() => ({}));
  const { line1, line2, street, city, state, region, postal_code, country, label, lat, lng, timezone } = body;

  try {
    // Check address exists
    const { data: existing } = await event.locals.supabase
      .from('addresses')
      .select('id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();

    if (!existing) {
      throw error(404, 'Address not found');
    }

    // Build dynamic update object
    const updates: Record<string, any> = {};
    if (line1 !== undefined) updates.line1 = line1 || null;
    if (line2 !== undefined) updates.line2 = line2 || null;
    if (street !== undefined) updates.street = street || null;
    if (city !== undefined) updates.city = city || null;
    if (state !== undefined) updates.state = state || null;
    if (region !== undefined) updates.region = region || null;
    if (postal_code !== undefined) updates.postal_code = postal_code || null;
    if (country !== undefined) updates.country = country || null;
    if (label !== undefined) updates.label = label || null;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (timezone !== undefined) updates.timezone = timezone || null;

    if (Object.keys(updates).length === 0) {
      throw error(400, 'No fields to update');
    }

    const { data: updated, error: updateError } = await event.locals.supabase
      .from('addresses')
      .update(updates)
      .eq('id', id)
      .eq('church_id', churchId)
      .select()
      .single();

    if (updateError) throw updateError;

    return json(updated);
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/addresses/[id] PUT', err);
    throw error(500, err.message || 'Database error');
  }
};

// DELETE - Delete an address
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    // Check if address is used as primary_address for a family
    const { data: familyCheck, error: checkError } = await event.locals.supabase
      .from('families')
      .select('id, name')
      .eq('primary_address_id', id)
      .eq('church_id', churchId);

    if (checkError) throw checkError;

    if (familyCheck && familyCheck.length > 0) {
      // Unlink from family before deleting
      const { error: unlinkError } = await event.locals.supabase
        .from('families')
        .update({ primary_address_id: null })
        .eq('primary_address_id', id);

      if (unlinkError) throw unlinkError;
    }

    const { data: deleted, error: delError } = await event.locals.supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id')
      .maybeSingle();

    if (delError) throw delError;

    if (!deleted) {
      throw error(404, 'Address not found');
    }

    return json({ success: true });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/addresses/[id] DELETE', err);
    throw error(500, err.message || 'Database error');
  }
};
