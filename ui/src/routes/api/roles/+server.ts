// /ui/src/routes/api/roles/+server.ts
// src/routes/api/roles/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  // Include inactive if requested (for admin views)
  const includeInactive = event.url.searchParams.get('include_inactive') === 'true';

  let query = event.locals.supabase
    .from('roles')
    .select(`
      id, name, ministry_area, description, load_weight, body_parts, is_active, team_id,
      team:teams(name, color, icon, display_order)
    `)
    .eq('church_id', churchId);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  // Sorting: Team Order -> Team Name -> Role Name
  query = query
    .order('display_order', { foreignTable: 'teams', ascending: true, nullsFirst: false })
    .order('name', { foreignTable: 'teams', ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  const { data, error: dbError } = await query;

  if (dbError) {
    console.error('[API] /api/roles GET failed:', dbError);
    throw error(500, 'Database error');
  }

  // Flatten response to match legacy format (team_name, team_color, etc.)
  const formatted = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    ministry_area: r.ministry_area,
    description: r.description,
    load_weight: r.load_weight,
    body_parts: r.body_parts,
    is_active: r.is_active,
    team_id: r.team_id,
    team_name: r.team?.name ?? null,
    team_color: r.team?.color ?? null,
    team_icon: r.team?.icon ?? null
  }));

  return json(formatted);
};

// POST - Create a new role
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const body = await event.request.json();
  const { name, team_id, ministry_area, description, load_weight = 10, body_parts = [] } = body;

  if (!name || name.trim() === '') {
    throw error(400, 'Role name is required');
  }

  // Check for duplicate name
  const { data: existing } = await event.locals.supabase
    .from('roles')
    .select('id')
    .eq('church_id', churchId)
    .ilike('name', name.trim()) // Use ilike for case-insensitive check
    .maybeSingle();

  if (existing) {
    throw error(409, 'A role with this name already exists');
  }

  const { data: created, error: insertError } = await event.locals.supabase
    .from('roles')
    .insert({
      church_id: churchId,
      name: name.trim(),
      team_id: team_id || null,
      ministry_area: ministry_area || null,
      description: description || null,
      load_weight,
      body_parts
    })
    .select()
    .single();

  if (insertError) {
    console.error('[API] /api/roles POST failed:', insertError);
    throw error(500, 'Database error');
  }

  return json(created, { status: 201 });
};
