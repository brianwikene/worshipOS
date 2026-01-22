// /ui/src/routes/api/roles/[id]/+server.ts
// src/routes/api/roles/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Get a single role
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    const { data: role, error: roleError } = await event.locals.supabase
      .from('roles')
      .select(`
        id, name, team_id, ministry_area, description, load_weight, body_parts, is_active,
        teams (
          name,
          color,
          icon
        )
      `)
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (roleError) {
      if (roleError.code === 'PGRST116') throw error(404, 'Role not found');
      throw roleError;
    }

    // Flatten team details
    // Check if teams is array or object (PostgREST should return object for BelongsTo)
    // but we handle safely
    const team = Array.isArray(role.teams) ? role.teams[0] : (role.teams as any);

    return json({
      ...role,
      team_name: team?.name,
      team_color: team?.color,
      team_icon: team?.icon,
      teams: undefined // Remove nested object from response
    });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/roles/[id] GET', err);
    throw error(500, err.message || 'Database error');
  }
};

// PUT - Update a role
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;
  const body = await event.request.json().catch(() => ({}));
  const { name, team_id, ministry_area, description, load_weight, body_parts, is_active } = body;

  try {
    // Check role exists
    const { data: existing } = await event.locals.supabase
      .from('roles')
      .select('id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();

    if (!existing) {
      throw error(404, 'Role not found');
    }

    // Check for duplicate name (excluding current role)
    if (name) {
      const { data: duplicate } = await event.locals.supabase
        .from('roles')
        .select('id')
        .eq('church_id', churchId)
        .ilike('name', name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        throw error(409, 'A role with this name already exists');
      }
    }

    // Build update object
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (team_id !== undefined) updates.team_id = team_id || null;
    if (ministry_area !== undefined) updates.ministry_area = ministry_area || null;
    if (description !== undefined) updates.description = description || null;
    if (load_weight !== undefined) updates.load_weight = load_weight;
    if (body_parts !== undefined) updates.body_parts = body_parts;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      throw error(400, 'No fields to update');
    }

    const { data: updated, error: updateError } = await event.locals.supabase
      .from('roles')
      .update(updates)
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id, name, team_id, ministry_area, description, load_weight, body_parts, is_active')
      .single();

    if (updateError) throw updateError;

    return json(updated);
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/roles/[id] PUT', err);
    throw error(500, err.message || 'Database error');
  }
};

// DELETE - Soft delete (deactivate) a role
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    // Check if role is in use
    const { count, error: countError } = await event.locals.supabase
      .from('service_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', id)
      .eq('church_id', churchId);

    if (countError) throw countError;

    const usageCount = count || 0;

    // Soft delete - just mark as inactive
    const { data: deleted, error: updateError } = await event.locals.supabase
      .from('roles')
      .update({ is_active: false })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') throw error(404, 'Role not found');
      throw updateError;
    }

    return json({
      success: true,
      message: usageCount > 0
        ? `Role deactivated. It was used in ${usageCount} assignment(s).`
        : 'Role deactivated.'
    });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/roles/[id] DELETE', err);
    throw error(500, err.message || 'Database error');
  }
};
