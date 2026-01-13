// src/routes/api/contexts/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const includeInactive = event.url.searchParams.get('include_inactive') === 'true';
  const includeRequirements = event.url.searchParams.get('include_requirements') === 'true';

  let query = `
    SELECT id, name, description, is_active
    FROM contexts
    WHERE church_id = $1 ${includeInactive ? '' : 'AND is_active = true'}
    ORDER BY name`;

  const result = await pool.query(query, [churchId]);

  if (includeRequirements) {
    // Get role requirements for each context
    const reqResult = await pool.query(
      `SELECT
        srr.context_id,
        srr.role_id,
        r.name AS role_name,
        r.ministry_area,
        srr.min_needed,
        srr.max_needed,
        srr.display_order
       FROM service_role_requirements srr
       JOIN roles r ON r.id = srr.role_id
       WHERE srr.church_id = $1
       ORDER BY srr.display_order, r.ministry_area NULLS LAST, r.name`,
      [churchId]
    );

    // Group requirements by context
    const reqByContext = reqResult.rows.reduce((acc: Record<string, any[]>, req) => {
      if (!acc[req.context_id]) acc[req.context_id] = [];
      acc[req.context_id].push({
        role_id: req.role_id,
        role_name: req.role_name,
        ministry_area: req.ministry_area,
        min_needed: req.min_needed,
        max_needed: req.max_needed,
        display_order: req.display_order
      });
      return acc;
    }, {});

    // Attach requirements to each context
    const contextsWithReqs = result.rows.map(ctx => ({
      ...ctx,
      role_requirements: reqByContext[ctx.id] || []
    }));

    return json(contextsWithReqs);
  }

  return json(result.rows);
};

// POST - Create a new context (service type)
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const body = await event.request.json();
  const { name, description } = body;

  if (!name || name.trim() === '') {
    throw error(400, 'Service type name is required');
  }

  // Check for duplicate
  const existing = await pool.query(
    'SELECT id FROM contexts WHERE church_id = $1 AND LOWER(name) = LOWER($2)',
    [churchId, name.trim()]
  );

  if (existing.rows.length > 0) {
    throw error(409, 'A service type with this name already exists');
  }

  const result = await pool.query(
    `INSERT INTO contexts (church_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, is_active`,
    [churchId, name.trim(), description || null]
  );

  return json(result.rows[0], { status: 201 });
};
