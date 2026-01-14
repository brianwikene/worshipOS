// src/routes/api/teams/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Get a single team with its roles
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    const { data: team, error: teamError } = await event.locals.supabase
      .from('teams')
      .select('id, name, description, color, icon, is_active, display_order')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (teamError) {
      if (teamError.code === 'PGRST116') throw error(404, 'Team not found');
      throw teamError;
    }

    // Get roles for this team
    const { data: roles, error: rolesError } = await event.locals.supabase
      .from('roles')
      .select('id, name, description, body_parts, load_weight, is_active')
      .eq('team_id', id)
      .eq('church_id', churchId)
      .order('name');

    if (rolesError) throw rolesError;

    return json({
      ...team,
      roles: roles || []
    });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/teams/[id] GET', err);
    throw error(500, err.message || 'Database error');
  }
};

// PUT - Update a team
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;
  const body = await event.request.json().catch(() => ({}));
  const { name, description, color, icon, is_active, display_order } = body;

  try {
    // Check for duplicate name if name is being updated
    if (name) {
      const { data: duplicate } = await event.locals.supabase
        .from('teams')
        .select('id')
        .eq('church_id', churchId)
        .ilike('name', name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        throw error(409, 'A team with this name already exists');
      }
    }

    // Build update object
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (is_active !== undefined) updates.is_active = is_active;
    if (display_order !== undefined) updates.display_order = display_order;

    if (Object.keys(updates).length === 0) {
      throw error(400, 'No fields to update');
    }

    const { data: updated, error: updateError } = await event.locals.supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id, name, description, color, icon, is_active, display_order')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') throw error(404, 'Team not found');
      throw updateError;
    }

    return json(updated);
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/teams/[id] PUT', err);
    throw error(500, err.message || 'Database error');
  }
};

// DELETE - Soft delete a team (roles become unassigned)
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    // Check how many roles are in this team
    const { count, error: countError } = await event.locals.supabase
      .from('roles')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', id)
      .eq('church_id', churchId);

    if (countError) throw countError;

    // Soft delete the team
    const { data: deleted, error: deleteError } = await event.locals.supabase
      .from('teams')
      .update({ is_active: false })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id')
      .single();

    if (deleteError) {
      if (deleteError.code === 'PGRST116') throw error(404, 'Team not found');
      throw deleteError;
    }

    // Unassign roles from this team
    const { error: unassignError } = await event.locals.supabase
      .from('roles')
      .update({ team_id: null })
      .eq('team_id', id)
      .eq('church_id', churchId);

    if (unassignError) throw unassignError;

    return json({
      success: true,
      roles_unassigned: count || 0
    });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/teams/[id] DELETE', err);
    throw error(500, err.message || 'Database error');
  }
};
