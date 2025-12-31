// src/routes/api/roles/[id]/capable-people/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// GET - Get people who have this role as a capability
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `SELECT
       p.id,
       p.first_name,
       p.last_name,
       prc.proficiency,
       prc.is_primary
     FROM people p
     JOIN person_role_capabilities prc ON prc.person_id = p.id
     WHERE prc.role_id = $1
       AND p.church_id = $2
       AND p.is_active = true
     ORDER BY prc.is_primary DESC, prc.proficiency DESC, p.last_name, p.first_name`,
    [id, churchId]
  );

  return json(result.rows);
};
