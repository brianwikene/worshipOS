import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**************************************************************
 * GET /api/people
 * List people for the active church
 **************************************************************/
export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');


  const search = url.searchParams.get('search');

  const result = await pool.query(
    `
    SELECT
      id,
      display_name,
      created_at
    FROM people
    WHERE church_id = $1
      AND (
        $2::text IS NULL
        OR display_name ILIKE '%' || $2 || '%'
      )
    ORDER BY display_name ASC
    `,
    [churchId, search]
  );

  return json(result.rows, { headers: { 'x-served-by': 'sveltekit' } });
};


/**************************************************************
 * POST /api/people
 * Create a new person in the active church
 **************************************************************/
export const POST: RequestHandler = async ({ locals, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const body = await request.json();
  const { display_name } = body;

  if (!display_name || typeof display_name !== 'string') {
    throw error(400, 'display_name is required');
  }

  const result = await pool.query(
    `
    INSERT INTO people (church_id, display_name)
    VALUES ($1, $2)
    RETURNING id, display_name, created_at
    `,
    [churchId, display_name.trim()]
  );

  return json(result.rows[0], {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};