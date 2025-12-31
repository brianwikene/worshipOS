import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**************************************************************
 * GET /api/people/:id
 * Get person detail with contact methods and addresses
 **************************************************************/
export const GET: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id } = params;

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
        p.updated_at,
        COALESCE(
          (SELECT json_agg(cm ORDER BY cm.is_primary DESC, cm.type)
           FROM contact_methods cm
           WHERE cm.person_id = p.id),
          '[]'
        ) as contact_methods,
        COALESCE(
          (SELECT json_agg(json_build_object(
             'id', a.id,
             'line1', a.line1,
             'line2', a.line2,
             'street', a.street,
             'city', a.city,
             'state', a.state,
             'postal_code', a.postal_code,
             'country', a.country,
             'label', a.label,
             'is_family_address', false
           ) ORDER BY a.created_at DESC)
           FROM addresses a
           WHERE a.person_id = p.id),
          '[]'
        ) as addresses,
        COALESCE(
          (SELECT json_agg(json_build_object(
             'id', a.id,
             'line1', a.line1,
             'line2', a.line2,
             'street', a.street,
             'city', a.city,
             'state', a.state,
             'postal_code', a.postal_code,
             'country', a.country,
             'label', COALESCE(a.label, f.name || ' Family'),
             'family_id', f.id,
             'family_name', f.name,
             'is_family_address', true,
             'is_primary', a.id = f.primary_address_id
           ) ORDER BY f.name, (a.id = f.primary_address_id) DESC, a.label NULLS LAST)
           FROM family_members fm
           JOIN families f ON f.id = fm.family_id AND f.is_active = true
           JOIN addresses a ON a.family_id = f.id
           WHERE fm.person_id = p.id AND fm.is_active = true),
          '[]'
        ) as family_addresses
      FROM people p
      WHERE p.id = $1
        AND p.church_id = $2
      `,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Person not found');
    }

    return json(result.rows[0], { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    // Re-throw SvelteKit errors
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('GET /api/people/:id failed:', err);
    throw error(500, 'Failed to load person');
  }
};

/**************************************************************
 * PUT /api/people/:id
 * Update person details
 * display_name is computed by database trigger
 **************************************************************/
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id } = params;
  const body = await request.json();
  const { first_name, last_name, goes_by } = body;

  // Require at least first_name or last_name
  if (!first_name && !last_name) {
    throw error(400, 'At least first_name or last_name is required');
  }

  try {
    const result = await pool.query(
      `
      UPDATE people
      SET first_name = $1,
          last_name = $2,
          goes_by = $3,
          updated_at = now()
      WHERE id = $4
        AND church_id = $5
      RETURNING id, first_name, last_name, goes_by, display_name, is_active, created_at, updated_at
      `,
      [first_name?.trim() || null, last_name?.trim() || null, goes_by?.trim() || null, id, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Person not found');
    }

    return json(result.rows[0], { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    // Re-throw SvelteKit errors
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('PUT /api/people/:id failed:', err);
    throw error(500, 'Failed to update person');
  }
};

/**************************************************************
 * DELETE /api/people/:id
 * Soft delete (archive) a person by setting is_active = false
 **************************************************************/
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id } = params;

  try {
    const result = await pool.query(
      `
      UPDATE people
      SET is_active = false,
          updated_at = now()
      WHERE id = $1
        AND church_id = $2
      RETURNING id, display_name
      `,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Person not found');
    }

    return json(
      { message: 'Person archived', person: result.rows[0] },
      { headers: { 'x-served-by': 'sveltekit' } }
    );
  } catch (err) {
    // Re-throw SvelteKit errors
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('DELETE /api/people/:id failed:', err);
    throw error(500, 'Failed to archive person');
  }
};