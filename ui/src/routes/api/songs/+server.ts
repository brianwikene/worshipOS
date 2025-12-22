import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const result = await pool.query(
    `SELECT id, title
     FROM songs
     WHERE church_id = $1
     ORDER BY title ASC`,
    [churchId]
  );

  return json(result.rows, {
    headers: { 'x-served-by': 'sveltekit' }
  });
};
