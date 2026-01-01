// POST /api/admin/merges/[id]/undo - Undo a merge

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**
 * POST /api/admin/merges/:id/undo
 * Undo a merge, restoring the merged person(s)
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: mergeId } = params;

  let reason: string | null = null;
  try {
    const body = await request.json();
    reason = body.reason || null;
  } catch {
    // No body or invalid JSON is fine
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Load the merge event
    const mergeResult = await client.query(
      `SELECT * FROM merge_events WHERE id = $1 AND church_id = $2`,
      [mergeId, churchId]
    );

    if (mergeResult.rows.length === 0) {
      throw error(404, 'Merge event not found');
    }

    const mergeEvent = mergeResult.rows[0];

    // Check if already undone
    if (mergeEvent.undone_at) {
      throw error(400, 'This merge has already been undone');
    }

    const survivorId = mergeEvent.survivor_id;
    const mergedIds: string[] = mergeEvent.merged_ids;
    const snapshots = mergeEvent.merged_snapshots;

    const restoredPeople: Array<{ id: string; display_name: string }> = [];

    // 2. Restore each merged person
    for (const mergedId of mergedIds) {
      const snapshot = snapshots[mergedId];
      if (!snapshot) {
        console.warn(`No snapshot found for merged person ${mergedId}`);
        continue;
      }

      // Restore the person record
      await client.query(
        `UPDATE people
         SET canonical_id = NULL,
             merged_at = NULL,
             is_active = true,
             first_name = $1,
             last_name = $2,
             goes_by = $3,
             display_name = $4,
             updated_at = now()
         WHERE id = $5`,
        [
          snapshot.first_name,
          snapshot.last_name,
          snapshot.goes_by,
          snapshot.display_name,
          mergedId
        ]
      );

      restoredPeople.push({
        id: mergedId,
        display_name: snapshot.display_name
      });

      // Note: We don't try to restore transferred records back to the merged person
      // because it's complex and could cause data loss. The admin should manually
      // reassign if needed. The records remain with the survivor.
    }

    // 3. Remove the "merged" alias from survivor
    await client.query(
      `DELETE FROM person_aliases
       WHERE person_id = $1 AND source LIKE 'merge:%'`,
      [survivorId]
    );

    // 4. Reopen the identity link if it exists
    if (mergeEvent.identity_link_id) {
      await client.query(
        `UPDATE identity_links
         SET status = 'confirmed',
             review_notes = COALESCE(review_notes || E'\n', '') || 'Merge was undone'
         WHERE id = $1`,
        [mergeEvent.identity_link_id]
      );
    }

    // 5. Mark merge event as undone
    // TODO: Get actual user ID from session
    const undoneBy = survivorId; // Placeholder

    await client.query(
      `UPDATE merge_events
       SET undone_at = now(),
           undone_by = $1,
           undo_reason = $2
       WHERE id = $3`,
      [undoneBy, reason, mergeId]
    );

    await client.query('COMMIT');

    return json({
      success: true,
      restored_people: restoredPeople,
      note: 'Transferred records (assignments, capabilities, etc.) remain with the survivor. Reassign manually if needed.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('POST /api/admin/merges/:id/undo failed:', err);
    throw error(500, 'Failed to undo merge');
  } finally {
    client.release();
  }
};
