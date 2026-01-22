// /ui/src/routes/api/contexts/[id]/+server.ts
// src/routes/api/contexts/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    const { data: context, error: contextError } = await event.locals.supabase
      .from('contexts')
      .select('id, name, description, is_active')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (contextError) {
      if (contextError.code === 'PGRST116') throw error(404, 'Service type not found');
      throw contextError;
    }

    // Get role requirements
    const { data: reqs, error: reqsError } = await event.locals.supabase
      .from('service_role_requirements')
      .select(`
        role_id,
        min_needed,
        max_needed,
        display_order,
        roles (
          name,
          ministry_area
        )
      `)
      .eq('context_id', id)
      .eq('church_id', churchId)
      .order('display_order');

    if (reqsError) throw reqsError;

    // Flatten and sort in JS because we need to sort by joined fields (ministry_area, name)
    // which Supabase/PostgREST makes difficult
    const flattenedReqs = (reqs || []).map((r: any) => ({
      role_id: r.role_id,
      role_name: r.roles?.name,
      ministry_area: r.roles?.ministry_area,
      min_needed: r.min_needed,
      max_needed: r.max_needed,
      display_order: r.display_order
    }));

    flattenedReqs.sort((a, b) => {
      // 1. display_order (already sorted by DB, but safe to keep)
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;

      // 2. ministry_area (NULLS LAST)
      if (a.ministry_area && !b.ministry_area) return -1;
      if (!a.ministry_area && b.ministry_area) return 1;
      if (a.ministry_area !== b.ministry_area) return String(a.ministry_area).localeCompare(String(b.ministry_area));

      // 3. role name
      return String(a.role_name || '').localeCompare(String(b.role_name || ''));
    });

    return json({
      ...context,
      role_requirements: flattenedReqs
    });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/contexts/[id] GET', err);
    throw error(500, err.message || 'Database error');
  }
};

// PUT - Update a context
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;
  const body = await event.request.json().catch(() => ({}));
  const { name, description, is_active, role_requirements } = body;

  try {
    // 1. Check duplicate name if changing
    if (name) {
      const { data: duplicate } = await event.locals.supabase
        .from('contexts')
        .select('id')
        .eq('church_id', churchId)
        .ilike('name', name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        throw error(409, 'A service type with this name already exists');
      }
    }

    // 2. Update context fields
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await event.locals.supabase
        .from('contexts')
        .update(updates)
        .eq('id', id)
        .eq('church_id', churchId);

      if (updateError) {
        if (updateError.code === 'PGRST116') throw error(404, 'Service type not found');
        throw updateError;
      }
    }

    // 3. Update role requirements if provided
    // NOTE: This is done sequentially. If failure occurs halfway, data might be inconsistent.
    // In a critical system, we'd use an RPC.
    if (role_requirements !== undefined) {
      // Delete existing
      const { error: delError } = await event.locals.supabase
        .from('service_role_requirements')
        .delete()
        .eq('context_id', id)
        .eq('church_id', churchId);

      if (delError) throw delError;

      // Insert new
      if (role_requirements.length > 0) {
        const toInsert = role_requirements.map((req: any, index: number) => ({
          church_id: churchId,
          context_id: id,
          role_id: req.role_id,
          min_needed: req.min_needed || 1,
          max_needed: req.max_needed || null,
          display_order: index
        }));

        const { error: insertError } = await event.locals.supabase
          .from('service_role_requirements')
          .insert(toInsert);

        if (insertError) throw insertError;
      }
    }

    // 4. Return updated data (refetch like GET to be safe and consistent)
    // We can just call the GET handler logic or re-query.
    // Re-querying context
    const { data: context } = await event.locals.supabase
      .from('contexts')
      .select('id, name, description, is_active')
      .eq('id', id)
      .single();

    // Re-querying requirements with JOIN for names
    const { data: reqs } = await event.locals.supabase
      .from('service_role_requirements')
      .select(`
        role_id,
        min_needed,
        max_needed,
        display_order,
        roles (
          name,
          ministry_area
        )
      `)
      .eq('context_id', id)
      .eq('church_id', churchId)
      .order('display_order');

    const flattenedReqs = (reqs || []).map((r: any) => ({
      role_id: r.role_id,
      role_name: r.roles?.name,
      ministry_area: r.roles?.ministry_area,
      min_needed: r.min_needed,
      max_needed: r.max_needed,
      display_order: r.display_order
    }));
    // Note: sorting is done by display_order in DB, others match original input order roughly.
    // We'll trust DB order for now or re-sort if strictly needed, but client likely refreshes.

    return json({
      ...context,
      role_requirements: flattenedReqs
    });

  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/contexts/[id] PUT', err);
    throw error(500, err.message || 'Database error');
  }
};

// DELETE - Soft delete a context
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  try {
    const { data, error: delError } = await event.locals.supabase
      .from('contexts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id')
      .single();

    if (delError) {
      if (delError.code === 'PGRST116') throw error(404, 'Service type not found');
      throw delError;
    }

    return json({ success: true });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/contexts/[id] DELETE', err);
    throw error(500, err.message || 'Database error');
  }
};
