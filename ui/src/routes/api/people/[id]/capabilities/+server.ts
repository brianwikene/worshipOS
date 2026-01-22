// /ui/src/routes/api/people/[id]/capabilities/+server.ts
// src/routes/api/people/[id]/capabilities/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List all role capabilities for a person
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const personId = event.params.id;

  const { data: capabilities, error: dbError } = await event.locals.supabase
    .from('person_role_capabilities')
    .select(`
      id,
      role_id,
      role:roles(name, ministry_area, body_parts),
      proficiency,
      is_primary,
      is_approved,
      notes
    `)
    .eq('church_id', churchId)
    .eq('person_id', personId);

  if (dbError) {
    console.error('GET /api/people/.../capabilities failed:', dbError);
    throw error(500, 'Failed to list capabilities');
  }

  // Flatten and Sort in JS to match previous logic
  const flattened = (capabilities || []).map((c: any) => ({
      id: c.id,
      role_id: c.role_id,
      role_name: c.role?.name,
      ministry_area: c.role?.ministry_area,
      body_parts: c.role?.body_parts,
      proficiency: c.proficiency,
      is_primary: c.is_primary,
      is_approved: c.is_approved,
      notes: c.notes
  }));

  flattened.sort((a: any, b: any) => {
      if (a.is_primary !== b.is_primary) return (a.is_primary ? -1 : 1);
      if (a.ministry_area !== b.ministry_area) {
          if (!a.ministry_area) return 1;
          if (!b.ministry_area) return -1;
          return (a.ministry_area || '').localeCompare(b.ministry_area || '');
      }
      return (a.role_name || '').localeCompare(b.role_name || '');
  });

  return json(flattened);
};

// POST - Add a role capability to a person
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const personId = event.params.id;
  const body = await event.request.json();
  const { role_id, proficiency = 3, is_primary = false, notes = null } = body;

  if (!role_id) {
    throw error(400, 'role_id is required');
  }

  // Verify the role exists and belongs to this church
  const { count } = await event.locals.supabase
    .from('roles')
    .select('id', { count: 'exact', head: true })
    .eq('id', role_id)
    .eq('church_id', churchId);

  if (!count) throw error(404, 'Role not found');

  // Check if already exists
  const { count: existsCount } = await event.locals.supabase
    .from('person_role_capabilities')
    .select('id', { count: 'exact', head: true })
    .eq('church_id', churchId)
    .eq('person_id', personId)
    .eq('role_id', role_id);

  if ((existsCount || 0) > 0) {
    throw error(409, 'Person already has this role capability');
  }

  // If setting as primary, unset other primaries first
  if (is_primary) {
    await event.locals.supabase
        .from('person_role_capabilities')
        .update({ is_primary: false })
        .eq('church_id', churchId)
        .eq('person_id', personId);
  }

  const { data: newCapability, error: insertError } = await event.locals.supabase
    .from('person_role_capabilities')
    .insert({
      church_id: churchId,
      person_id: personId,
      role_id,
      proficiency,
      is_primary,
      is_approved: true,
      notes
    })
    .select('id')
    .single();

  if (insertError) {
      console.error('POST /api/people/.../capabilities failed:', insertError);
      throw error(500, 'Failed to add capability');
  }

  return json({ success: true, id: newCapability.id }, { status: 201 });
};
