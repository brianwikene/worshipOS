// /ui/src/routes/api/families/[id]/address/+server.ts
// src/routes/api/families/[id]/address/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Create new family address
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  const supabase = event.locals.supabase;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: familyId } = event.params;
  const body = await event.request.json();
  const { line1, line2, city, state, postal_code, country = 'US', label, is_primary } = body;

  // Check family exists
  const { data: family, error: fErr } = await supabase
    .from('families')
    .select('id, primary_address_id')
    .eq('id', familyId)
    .eq('church_id', churchId)
    .single();

  if (fErr || !family) throw error(404, 'Family not found');

  // Create new address
  const { data: newAddress, error: addrErr } = await supabase
    .from('addresses')
    .insert({
        church_id: churchId,
        family_id: familyId,
        line1: line1 || null,
        line2: line2 || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country,
        label: label || null
    })
    .select('*')
    .single();

  if (addrErr) {
      console.error('Create address error:', addrErr);
      throw error(500, 'Failed to create address');
  }

  // Update primary if needed
  if (is_primary || !family.primary_address_id) {
      await supabase
        .from('families')
        .update({ primary_address_id: newAddress.id })
        .eq('id', familyId);
      newAddress.is_primary = true;
  } else {
      newAddress.is_primary = false;
  }

  return json(newAddress, { status: 201 });
};

// PUT - Update existing family address
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  const supabase = event.locals.supabase;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: familyId } = event.params;
  const body = await event.request.json();
  const { line1, line2, city, state, postal_code, country = 'US', label, address_id, is_primary } = body;

  // Check family exists
  const { data: family, error: fErr } = await supabase
    .from('families')
    .select('id, primary_address_id')
    .eq('id', familyId)
    .eq('church_id', churchId)
    .single();

  if (fErr || !family) throw error(404, 'Family not found');

  if (address_id) {
      // Update existing address
      const { data: updatedAddr, error: upErr } = await supabase
        .from('addresses')
        .update({
            line1: line1 || null,
            line2: line2 || null,
            city: city || null,
            state: state || null,
            postal_code: postal_code || null,
            country: country,
            label: label || null
        })
        .eq('id', address_id)
        .eq('family_id', familyId)
        .eq('church_id', churchId)
        .select('*')
        .single();

      if (upErr || !updatedAddr) throw error(404, 'Address not found');

      // Update primary if requested
      if (is_primary && family.primary_address_id !== address_id) {
          await supabase
            .from('families')
            .update({ primary_address_id: address_id })
            .eq('id', familyId);
      }

      return json({
          ...updatedAddr,
          is_primary: is_primary || family.primary_address_id === address_id
      });

  } else if (family.primary_address_id) {
      // Legacy: Update existing primary address
      const { data: updatedAddr, error: upErr } = await supabase
        .from('addresses')
        .update({
            line1: line1 || null,
            line2: line2 || null,
            city: city || null,
            state: state || null,
            postal_code: postal_code || null,
            country: country,
            label: label || null,
            family_id: familyId
        })
        .eq('id', family.primary_address_id)
        .eq('church_id', churchId)
        .select('*')
        .single();

      if (upErr) throw error(500, 'Failed to update address');
      return json({ ...updatedAddr, is_primary: true });

  } else {
      // Create new address (legacy path)
      const { data: newAddress, error: addrErr } = await supabase
        .from('addresses')
        .insert({
            church_id: churchId,
            family_id: familyId,
            line1: line1 || null,
            line2: line2 || null,
            city: city || null,
            state: state || null,
            postal_code: postal_code || null,
            country: country,
            label: label || null
        })
        .select('*')
        .single();

      if (addrErr) throw error(500, 'Failed to create address');

      await supabase
        .from('families')
        .update({ primary_address_id: newAddress.id })
        .eq('id', familyId);

      return json({ ...newAddress, is_primary: true }, { status: 201 });
  }
};

// DELETE - Remove family address
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  const supabase = event.locals.supabase;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: familyId } = event.params;
  const url = new URL(event.request.url);
  const addressId = url.searchParams.get('address_id');

  // Get family with address
  const { data: family, error: fErr } = await supabase
    .from('families')
    .select('id, primary_address_id')
    .eq('id', familyId)
    .eq('church_id', churchId)
    .single();

  if (fErr || !family) throw error(404, 'Family not found');

  const targetAddressId = addressId || family.primary_address_id;

  if (!targetAddressId) {
    return json({ success: true, message: 'No address to delete' });
  }

  // If deleting the primary address, update family
  if (family.primary_address_id === targetAddressId) {
      // Find another address
      const { data: others } = await supabase
        .from('addresses')
        .select('id')
        .eq('family_id', familyId)
        .neq('id', targetAddressId)
        .limit(1);

      const newPrimaryId = others && others.length > 0 ? others[0].id : null;

      await supabase
        .from('families')
        .update({ primary_address_id: newPrimaryId })
        .eq('id', familyId);
  }

  // Delete the address
  const { error: delErr } = await supabase
    .from('addresses')
    .delete()
    .eq('id', targetAddressId)
    .eq('church_id', churchId);

  if (delErr) {
      console.error('Delete address error:', delErr);
      throw error(500, 'Failed to delete address');
  }

  return json({ success: true });
};
