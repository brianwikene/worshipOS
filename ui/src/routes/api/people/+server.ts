import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**************************************************************
 * GET /api/people
 * List people for the active church with optional search
 * Includes has_contact_info flag for UI display
 **************************************************************/
export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const search = url.searchParams.get('search');

  try {
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.first_name,
        p.last_name,
        p.goes_by,
        p.display_name,
        p.is_active,
        p.created_at,
        EXISTS (
          SELECT 1 FROM contact_methods cm
          WHERE cm.person_id = p.id
        ) as has_contact_info
      FROM people p
      WHERE p.church_id = $1
        AND p.is_active = true
        AND (
          $2::text IS NULL
          OR p.display_name ILIKE '%' || $2 || '%'
          OR p.first_name ILIKE '%' || $2 || '%'
          OR p.last_name ILIKE '%' || $2 || '%'
        )
      ORDER BY p.display_name ASC
      `,
      [churchId, search]
    );

    return json(result.rows, { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    console.error('GET /api/people failed:', err);
    throw error(500, 'Failed to load people');
  }
};

/**************************************************************
 * POST /api/people
 * Create a new person in the active church
 * display_name is computed by database trigger
 **************************************************************/
export const POST: RequestHandler = async ({ locals, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const body = await request.json();
  const { first_name, last_name, goes_by } = body;

  // Require at least first_name or last_name
  if (!first_name && !last_name) {
    throw error(400, 'At least first_name or last_name is required');
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO people (church_id, first_name, last_name, goes_by, display_name)
      VALUES ($1, $2, $3, $4, '')
      RETURNING id, first_name, last_name, goes_by, display_name, is_active, created_at
      `,
      [churchId, first_name?.trim() || null, last_name?.trim() || null, goes_by?.trim() || null]
    );

    return json(result.rows[0], {
      status: 201,
      headers: { 'x-served-by': 'sveltekit' }
    });
  } catch (err) {
    console.error('POST /api/people failed:', err);
    throw error(500, 'Failed to create person');
  }
};