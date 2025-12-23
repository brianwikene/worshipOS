import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**************************************************************
 * GET /api/families
 * List families for the active church with member counts
 **************************************************************/
export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const search = url.searchParams.get('search');
  const includeInactive = url.searchParams.get('include_inactive') === 'true';

  try {
    const result = await pool.query(
      `
      SELECT
        f.id,
        f.name,
        f.notes,
        f.is_active,
        f.created_at,
        COUNT(DISTINCT fm.person_id) FILTER (WHERE fm.is_active = true) as member_count,
        COUNT(DISTINCT fm.person_id) FILTER (
          WHERE fm.relationship IN ('child', 'foster_child')
          AND fm.is_active = true
        ) as child_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'display_name', p.display_name
            ) ORDER BY p.display_name
          ) FILTER (WHERE fm.is_primary_contact = true AND fm.is_active = true),
          '[]'
        ) as primary_contacts
      FROM families f
      LEFT JOIN family_members fm ON fm.family_id = f.id
      LEFT JOIN people p ON p.id = fm.person_id AND fm.is_primary_contact = true AND fm.is_active = true
      WHERE f.church_id = $1
        AND ($2::boolean OR f.is_active = true)
        AND (
          $3::text IS NULL
          OR f.name ILIKE '%' || $3 || '%'
        )
      GROUP BY f.id, f.name, f.notes, f.is_active, f.created_at
      ORDER BY f.name ASC
      `,
      [churchId, includeInactive, search]
    );

    return json(result.rows, { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    console.error('GET /api/families failed:', err);
    throw error(500, 'Failed to load families');
  }
};

/**************************************************************
 * POST /api/families
 * Create a new family
 **************************************************************/
export const POST: RequestHandler = async ({ locals, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const body = await request.json();
  const { name, notes } = body;

  if (!name || typeof name !== 'string') {
    throw error(400, 'name is required');
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO families (church_id, name, notes)
      VALUES ($1, $2, $3)
      RETURNING id, name, notes, is_active, created_at
      `,
      [churchId, name.trim(), notes?.trim() || null]
    );

    return json(result.rows[0], {
      status: 201,
      headers: { 'x-served-by': 'sveltekit' }
    });
  } catch (err) {
    console.error('POST /api/families failed:', err);
    throw error(500, 'Failed to create family');
  }
};