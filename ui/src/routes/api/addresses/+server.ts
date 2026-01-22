// /ui/src/routes/api/addresses/+server.ts
// src/routes/api/addresses/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Get all addresses for the church (optionally filtered by person_id or family)
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  /**
   * RE: Church ID Check
   * In a perfect world, we'd rely solely on RLS.
   * However, since we filter by church_id in the query logic below,
   * keeping this check ensures we don't accidentally return data if RLS is misconfigured.
   */
  if (!churchId) throw error(400, 'Active church is required');

  const personId = event.url.searchParams.get('person_id');
  const familyId = event.url.searchParams.get('family_id');

  try {
    let query = event.locals.supabase
      .from('addresses')
      .select('id, person_id, line1, line2, city, state, region, postal_code, country, label, lat, lng, timezone, street, created_at')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false });

    if (personId) {
      query = query.eq('person_id', personId);
    } else if (familyId) {
      // Get addresses linked to family via primary_address_id
      // We need to filter addresses where they are the primary_address of the given familyId
      // This requires joining families.
      // families.primary_address_id refers to addresses.id
      query = event.locals.supabase
        .from('addresses')
        .select('id, person_id, line1, line2, city, state, region, postal_code, country, label, lat, lng, timezone, street, created_at, families!inner(id)')
        .eq('church_id', churchId)
        .eq('families.id', familyId)
        .order('created_at', { ascending: false });
    }

    const { data: addresses, error: dbError } = await query;

    if (dbError) throw dbError;

    return json(addresses);
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/addresses GET', err);
    throw error(500, 'Database error');
  }
};

// POST - Create a new address
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const body = await event.request.json().catch(() => ({}));
  const {
    person_id,
    line1,
    line2,
    street,
    city,
    state,
    region,
    postal_code,
    country = 'US',
    label,
    lat,
    lng,
    timezone
  } = body;

  try {
    const { data: newAddress, error: insertError } = await event.locals.supabase
      .from('addresses')
      .insert({
        church_id: churchId,
        person_id: person_id || null,
        line1,
        line2,
        street,
        city,
        state,
        region,
        postal_code,
        country,
        label,
        lat,
        lng,
        timezone
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return json(newAddress, { status: 201 });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/addresses POST', err);
    throw error(500, 'Database error');
  }
};
