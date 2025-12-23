import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**************************************************************
 * POST /api/families/:id/members
 * Add a person to a family
 **************************************************************/
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'church_id is required');

  const { id: familyId } = params;
  const body = await request.json();
  const { person_id, relationship, is_primary_contact, is_temporary, notes } = body;

  if (!person_id) {
    throw error(400, 'person_id is required');
  }

  if (!relationship) {
    throw error(400, 'relationship is required');
  }

  // Validate relationship type
  const validRelationships = ['parent', 'guardian', 'spouse', 'child', 'foster_child', 'grandparent', 'sibling', 'other'];
  if (!validRelationships.includes(relationship)) {
    throw error(400, `Invalid relationship. Must be one of: ${validRelationships.join(', ')}`);
  }

  try {
    // Verify family exists and belongs to church
    const familyCheck = await pool.query(
      `SELECT id FROM families WHERE id = $1 AND church_id = $2`,
      [familyId, churchId]
    );

    if (familyCheck.rows.length === 0) {
      throw error(404, 'Family not found');
    }

    // Verify person exists and belongs to church
    const personCheck = await pool.query(
      `SELECT id FROM people WHERE id = $1 AND church_id = $2`,
      [person_id, churchId]
    );

    if (personCheck.rows.length === 0) {
      throw error(404, 'Person not found');
    }

    const result = await pool.query(
      `
      INSERT INTO family_members (
        church_id, family_id, person_id, relationship, 
        is_primary_contact, is_temporary, notes, start_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
      ON CONFLICT (church_id, family_id, person_id) 
      DO UPDATE SET
        relationship = EXCLUDED.relationship,
        is_primary_contact = EXCLUDED.is_primary_contact,
        is_temporary = EXCLUDED.is_temporary,
        notes = EXCLUDED.notes,
        is_active = true,
        end_date = NULL,
        updated_at = now()
      RETURNING *
      `,
      [
        churchId,
        familyId,
        person_id,
        relationship,
        is_primary_contact || false,
        is_temporary || false,
        notes?.trim() || null
      ]
    );

    return json(result.rows[0], {
      status: 201,
      headers: { 'x-served-by': 'sveltekit' }
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('POST /api/families/:id/members failed:', err);
    throw error(500, 'Failed to add family member');
  }
};