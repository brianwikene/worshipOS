// GET/PUT /api/admin/duplicates/[id] - Get or update a specific identity link

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**
 * GET /api/admin/duplicates/:id
 * Get details of a specific identity link
 */
export const GET: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = params;

  try {
    const result = await pool.query(
      `SELECT
        il.*,
        pa.display_name as person_a_display_name,
        pb.display_name as person_b_display_name,
        r.display_name as reviewer_name
      FROM identity_links il
      JOIN people pa ON pa.id = il.person_a_id
      JOIN people pb ON pb.id = il.person_b_id
      LEFT JOIN people r ON r.id = il.reviewed_by
      WHERE il.id = $1 AND il.church_id = $2`,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Identity link not found');
    }

    return json(result.rows[0]);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('GET /api/admin/duplicates/:id failed:', err);
    throw error(500, 'Failed to load identity link');
  }
};

/**
 * PUT /api/admin/duplicates/:id
 * Update status of an identity link (confirm, reject, etc.)
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = params;
  const body = await request.json();
  const { status, review_notes, suppress_duration_days } = body;

  // Validate status
  const validStatuses = ['suggested', 'confirmed', 'not_match'];
  if (status && !validStatuses.includes(status)) {
    throw error(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  try {
    // Verify the link exists and belongs to this church
    const checkResult = await pool.query(
      'SELECT id, status FROM identity_links WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (checkResult.rows.length === 0) {
      throw error(404, 'Identity link not found');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);

      // Set reviewed_at and reviewed_by when status changes
      updates.push(`reviewed_at = now()`);
      // TODO: Get actual user ID from session
      // updates.push(`reviewed_by = $${paramIndex++}`);
      // values.push(userId);
    }

    if (review_notes !== undefined) {
      updates.push(`review_notes = $${paramIndex++}`);
      values.push(review_notes || null);
    }

    // Set suppression for "not a match"
    if (status === 'not_match') {
      const days = suppress_duration_days || 365;
      updates.push(`suppressed_until = now() + interval '${days} days'`);
    }

    if (updates.length === 0) {
      throw error(400, 'No valid fields to update');
    }

    // Add id and church_id to values
    values.push(id);
    values.push(churchId);

    const result = await pool.query(
      `UPDATE identity_links
       SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${paramIndex++} AND church_id = $${paramIndex}
       RETURNING *`,
      values
    );

    return json(result.rows[0]);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('PUT /api/admin/duplicates/:id failed:', err);
    throw error(500, 'Failed to update identity link');
  }
};

/**
 * DELETE /api/admin/duplicates/:id
 * Delete an identity link (only for 'suggested' status)
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = params;

  try {
    // Only allow deletion of 'suggested' links
    const result = await pool.query(
      `DELETE FROM identity_links
       WHERE id = $1 AND church_id = $2 AND status = 'suggested'
       RETURNING id`,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      throw error(404, 'Identity link not found or cannot be deleted');
    }

    return json({ success: true, deleted_id: id });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('DELETE /api/admin/duplicates/:id failed:', err);
    throw error(500, 'Failed to delete identity link');
  }
};
