// /ui/src/routes/api/contexts/+server.ts
// src/routes/api/contexts/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const includeInactive = event.url.searchParams.get('include_inactive') === 'true';
  const includeRequirements = event.url.searchParams.get('include_requirements') === 'true';

  try {
    let query = event.locals.supabase
      .from('contexts')
      .select('id, name, description, is_active')
      .eq('church_id', churchId)
      .order('name');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: contexts, error: dbError } = await query;

    if (dbError) throw dbError;

    if (includeRequirements) {
      // Get role requirements for each context
      const { data: requirements, error: reqError } = await event.locals.supabase
        .from('service_role_requirements')
        .select(`
          context_id,
          role_id,
          min_needed,
          max_needed,
          display_order,
          role:roles (
            name,
            ministry_area
          )
        `)
        .eq('church_id', churchId)
        .order('display_order');

      if (reqError) throw reqError;

      // Group requirements by context
      const reqByContext = (requirements || []).reduce((acc: Record<string, any[]>, req: any) => {
        if (!acc[req.context_id]) acc[req.context_id] = [];
        acc[req.context_id].push({
          role_id: req.role_id,
          role_name: req.role?.name,
          ministry_area: req.role?.ministry_area,
          min_needed: req.min_needed,
          max_needed: req.max_needed,
          display_order: req.display_order
        });
        return acc;
      }, {});

      // Apply internal sort after grouping (Ministry Area -> Role Name)
      // since the DB sort on display_order is primary but the others are secondary logic
      Object.keys(reqByContext).forEach(key => {
        reqByContext[key].sort((a, b) => {
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          if (a.ministry_area !== b.ministry_area)
            return String(a.ministry_area || '').localeCompare(String(b.ministry_area || ''));
          return String(a.role_name || '').localeCompare(String(b.role_name || ''));
        });
      });

      // Attach requirements to each context
      const contextsWithReqs = (contexts || []).map(ctx => ({
        ...ctx,
        role_requirements: reqByContext[ctx.id] || []
      }));

      return json(contextsWithReqs);
    }

    return json(contexts);
  } catch (err: any) {
    console.error('[API] /api/contexts GET failed:', err);
    throw error(500, err.message || 'Database error');
  }
};

// POST - Create a new context (service type)
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const body = await event.request.json();
  const { name, description } = body;

  if (!name || name.trim() === '') {
    throw error(400, 'Service type name is required');
  }

  // Check for duplicate
  const { data: existing } = await event.locals.supabase
    .from('contexts')
    .select('id')
    .eq('church_id', churchId)
    .ilike('name', name.trim())
    .maybeSingle();

  if (existing) {
    throw error(409, 'A service type with this name already exists');
  }

  const { data: created, error: insertError } = await event.locals.supabase
    .from('contexts')
    .insert({
      church_id: churchId,
      name: name.trim(),
      description: description || null
    })
    .select()
    .single();

  if (insertError) {
    console.error('[API] /api/contexts POST failed:', insertError);
    throw error(500, 'Database error');
  }

  return json(created, { status: 201 });
};
