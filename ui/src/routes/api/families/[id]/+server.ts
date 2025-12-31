import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**************************************************************
 * GET /api/families/:id
 * Get family detail with all members
 **************************************************************/
export const GET: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id } = params;

  try {
    // Get family info
    const familyResult = await pool.query(
      `
      SELECT
        f.id,
        f.name,
        f.notes,
        f.is_active,
        f.primary_address_id as address_id,
        f.created_at,
        f.updated_at,
        a.line1 as address_line1,
        a.line2 as address_line2,
        a.street,
        a.city,
        a.state,
        a.postal_code,
        a.country,
        a.label as address_label
      FROM families f
      LEFT JOIN addresses a ON a.id = f.primary_address_id
      WHERE f.id = $1
        AND f.church_id = $2
      `,
      [id, churchId]
    );

    if (familyResult.rows.length === 0) {
      throw error(404, 'Family not found');
    }

    const family = familyResult.rows[0];

    // Get family members
    const membersResult = await pool.query(
      `
      SELECT
        fm.id as membership_id,
        fm.person_id,
        p.display_name,
        p.first_name,
        p.last_name,
        p.goes_by,
        fm.relationship,
        fm.is_active,
        fm.is_temporary,
        fm.is_primary_contact,
        TO_CHAR(fm.start_date, 'YYYY-MM-DD') as start_date,
        TO_CHAR(fm.end_date, 'YYYY-MM-DD') as end_date,
        fm.notes
      FROM family_members fm
      JOIN people p ON p.id = fm.person_id
      WHERE fm.family_id = $1
      ORDER BY
        fm.is_active DESC,
        CASE fm.relationship
          WHEN 'parent' THEN 1
          WHEN 'guardian' THEN 2
          WHEN 'spouse' THEN 3
          WHEN 'child' THEN 4
          WHEN 'foster_child' THEN 5
          ELSE 6
        END,
        p.display_name
      `,
      [id]
    );

    family.members = membersResult.rows;

    return json(family, { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('GET /api/families/:id failed:', err);
    throw error(500, 'Failed to load family');
  }
};

/**************************************************************
 * PUT /api/families/:id
 * Update family details
 **************************************************************/
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id } = params;
  const body = await request.json();
  const { name, notes } = body;

  if (!name || typeof name !== 'string') {
    throw error(400, 'name is required');
  }

  try {
    const result = await pool.query(
      `
      UPDATE families
      SET name = $1,
          notes = $2,
          updated_at = now()
      WHERE id = $3
        AND church_id = $4
      RETURNING id, name, notes, is_active, created_at, updated_at
      `,
      [name.trim(), notes?.trim() || null, id, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Family not found');
    }

    return json(result.rows[0], { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('PUT /api/families/:id failed:', err);
    throw error(500, 'Failed to update family');
  }
};

/**************************************************************
 * DELETE /api/families/:id
 * Soft delete (archive) a family
 **************************************************************/
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id } = params;

  try {
    const result = await pool.query(
      `
      UPDATE families
      SET is_active = false,
          updated_at = now()
      WHERE id = $1
        AND church_id = $2
      RETURNING id, name
      `,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Family not found');
    }

    return json(
      { message: 'Family archived', family: result.rows[0] },
      { headers: { 'x-served-by': 'sveltekit' } }
    );
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('DELETE /api/families/:id failed:', err);
    throw error(500, 'Failed to archive family');
  }
};