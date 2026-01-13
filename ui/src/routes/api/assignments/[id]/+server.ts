// src/routes/api/assignments/[id]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;
  const body = await event.request.json();
  const { person_id, status, is_lead, notes } = body;

  const result = await pool.query(
    `UPDATE service_assignments
     SET person_id = COALESCE($1, person_id),
         status = COALESCE($2, status),
         is_lead = COALESCE($3, is_lead),
         notes = COALESCE($4, notes),
         updated_at = now()
     WHERE id = $5
     RETURNING *`,
    [person_id, status, is_lead, notes, id]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Assignment not found');
  }

  return json(result.rows[0], {
    headers: { 'x-served-by': 'sveltekit' }
  });
};

export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `DELETE FROM service_assignments WHERE id = $1 RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Assignment not found');
  }

  return json(
    { message: 'Assignment removed', assignment: result.rows[0] },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
