import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**************************************************************
 * PUT /api/families/:id/members/:memberId
 * Update a family membership
 **************************************************************/
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id: familyId, memberId } = params;
  const body = await request.json();
  const { relationship, is_primary_contact, is_temporary, notes } = body;

  try {
    const result = await pool.query(
      `
      UPDATE family_members
      SET relationship = COALESCE($1, relationship),
          is_primary_contact = COALESCE($2, is_primary_contact),
          is_temporary = COALESCE($3, is_temporary),
          notes = $4,
          updated_at = now()
      WHERE id = $5
        AND family_id = $6
        AND church_id = $7
      RETURNING *
      `,
      [
        relationship,
        is_primary_contact,
        is_temporary,
        notes?.trim() || null,
        memberId,
        familyId,
        churchId
      ]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Family member not found');
    }

    return json(result.rows[0], { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('PUT /api/families/:id/members/:memberId failed:', err);
    throw error(500, 'Failed to update family member');
  }
};

/**************************************************************
 * DELETE /api/families/:id/members/:memberId
 * Remove a person from a family (soft delete)
 **************************************************************/
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id: familyId, memberId } = params;

  try {
    const result = await pool.query(
      `
      UPDATE family_members
      SET is_active = false,
          end_date = CURRENT_DATE,
          updated_at = now()
      WHERE id = $1
        AND family_id = $2
        AND church_id = $3
      RETURNING id, person_id
      `,
      [memberId, familyId, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Family member not found');
    }

    return json(
      { message: 'Member removed from family', member: result.rows[0] },
      { headers: { 'x-served-by': 'sveltekit' } }
    );
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('DELETE /api/families/:id/members/:memberId failed:', err);
    throw error(500, 'Failed to remove family member');
  }
};