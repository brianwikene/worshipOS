// GET /api/admin/duplicates - List duplicate candidates
// POST /api/admin/duplicates/scan - Trigger duplicate detection scan

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';
import { findDuplicates, saveDetectedDuplicates } from '$lib/server/duplicates/detector';

/**
 * GET /api/admin/duplicates
 * List duplicate candidates from identity_links table
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  // Parse query params
  const status = url.searchParams.get('status') || 'suggested';
  const minScore = parseInt(url.searchParams.get('min_score') || '0', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // Validate status
  const validStatuses = ['suggested', 'confirmed', 'not_match', 'merged', 'all'];
  if (!validStatuses.includes(status)) {
    throw error(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  try {
    // Build query based on status filter
    let statusFilter = '';
    if (status !== 'all') {
      statusFilter = `AND il.status = $4`;
    }

    // Query identity links with person details
    const result = await pool.query(
      `SELECT
        il.id,
        il.person_a_id,
        il.person_b_id,
        il.status,
        il.confidence_score,
        il.match_reasons,
        il.detected_at,
        il.detected_by,
        il.reviewed_at,
        il.reviewed_by,
        il.review_notes,
        -- Person A details
        pa.display_name as person_a_display_name,
        pa.first_name as person_a_first_name,
        pa.last_name as person_a_last_name,
        pa.goes_by as person_a_goes_by,
        pa.created_at as person_a_created_at,
        (SELECT cm.value FROM contact_methods cm WHERE cm.person_id = pa.id AND cm.type = 'email' LIMIT 1) as person_a_email,
        (SELECT cm.value FROM contact_methods cm WHERE cm.person_id = pa.id AND cm.type = 'phone' LIMIT 1) as person_a_phone,
        -- Person B details
        pb.display_name as person_b_display_name,
        pb.first_name as person_b_first_name,
        pb.last_name as person_b_last_name,
        pb.goes_by as person_b_goes_by,
        pb.created_at as person_b_created_at,
        (SELECT cm.value FROM contact_methods cm WHERE cm.person_id = pb.id AND cm.type = 'email' LIMIT 1) as person_b_email,
        (SELECT cm.value FROM contact_methods cm WHERE cm.person_id = pb.id AND cm.type = 'phone' LIMIT 1) as person_b_phone,
        -- Reviewer details
        r.display_name as reviewer_name
      FROM identity_links il
      JOIN people pa ON pa.id = il.person_a_id
      JOIN people pb ON pb.id = il.person_b_id
      LEFT JOIN people r ON r.id = il.reviewed_by
      WHERE il.church_id = $1
        AND il.confidence_score >= $2
        AND (il.suppressed_until IS NULL OR il.suppressed_until < now())
        ${statusFilter}
      ORDER BY il.confidence_score DESC, il.detected_at DESC
      LIMIT $3 OFFSET ${status !== 'all' ? '$5' : '$4'}`,
      status !== 'all'
        ? [churchId, minScore, limit, status, offset]
        : [churchId, minScore, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM identity_links il
       WHERE il.church_id = $1
         AND il.confidence_score >= $2
         AND (il.suppressed_until IS NULL OR il.suppressed_until < now())
         ${status !== 'all' ? 'AND il.status = $3' : ''}`,
      status !== 'all'
        ? [churchId, minScore, status]
        : [churchId, minScore]
    );

    // Format response
    const duplicates = result.rows.map(row => ({
      id: row.id,
      person_a: {
        id: row.person_a_id,
        display_name: row.person_a_display_name,
        first_name: row.person_a_first_name,
        last_name: row.person_a_last_name,
        goes_by: row.person_a_goes_by,
        email: row.person_a_email,
        phone: row.person_a_phone,
        created_at: row.person_a_created_at
      },
      person_b: {
        id: row.person_b_id,
        display_name: row.person_b_display_name,
        first_name: row.person_b_first_name,
        last_name: row.person_b_last_name,
        goes_by: row.person_b_goes_by,
        email: row.person_b_email,
        phone: row.person_b_phone,
        created_at: row.person_b_created_at
      },
      confidence_score: parseFloat(row.confidence_score),
      match_reasons: row.match_reasons,
      status: row.status,
      detected_at: row.detected_at,
      detected_by: row.detected_by,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      reviewer_name: row.reviewer_name,
      review_notes: row.review_notes
    }));

    return json({
      duplicates,
      total: parseInt(countResult.rows[0].total, 10),
      limit,
      offset
    });
  } catch (err) {
    console.error('GET /api/admin/duplicates failed:', err);
    throw error(500, 'Failed to load duplicates');
  }
};
