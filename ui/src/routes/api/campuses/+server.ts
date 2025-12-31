// src/routes/api/campuses/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const result = await pool.query(
    `SELECT id, name, location, is_active
     FROM campuses
     WHERE church_id = $1 AND is_active = true
     ORDER BY name`,
    [churchId]
  );

  return json(result.rows);
};
