// GET /api/admin/merges - List merge history

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

/**
 * GET /api/admin/merges
 * List merge history
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const includeUndone = url.searchParams.get('include_undone') === 'true';

  try {
    let undoneFilter = '';
    if (!includeUndone) {
      undoneFilter = 'AND undone_at IS NULL';
    }

    const result = await pool.query(
      `SELECT
        me.id,
        me.survivor_id,
        me.merged_ids,
        me.field_resolutions,
        me.transferred_records,
        me.performed_at,
        me.reason,
        me.undone_at,
        me.undo_reason,
        s.display_name as survivor_name,
        p.display_name as performed_by_name,
        u.display_name as undone_by_name,
        -- Get names of merged people from snapshots
        me.merged_snapshots
      FROM merge_events me
      JOIN people s ON s.id = me.survivor_id
      JOIN people p ON p.id = me.performed_by
      LEFT JOIN people u ON u.id = me.undone_by
      WHERE me.church_id = $1
        ${undoneFilter}
      ORDER BY me.performed_at DESC
      LIMIT $2 OFFSET $3`,
      [churchId, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM merge_events
       WHERE church_id = $1 ${undoneFilter}`,
      [churchId]
    );

    // Format response
    const merges = result.rows.map(row => {
      // Extract merged names from snapshots
      const snapshots = row.merged_snapshots || {};
      const mergedNames = row.merged_ids.map((id: string) => {
        const snapshot = snapshots[id];
        return snapshot?.display_name || 'Unknown';
      });

      return {
        id: row.id,
        survivor_id: row.survivor_id,
        survivor_name: row.survivor_name,
        merged_ids: row.merged_ids,
        merged_names: mergedNames,
        merged_count: row.merged_ids.length,
        field_resolutions: row.field_resolutions,
        transferred_records: row.transferred_records,
        performed_by: row.performed_by_name,
        performed_at: row.performed_at,
        reason: row.reason,
        can_undo: !row.undone_at,
        undone_at: row.undone_at,
        undone_by: row.undone_by_name,
        undo_reason: row.undo_reason
      };
    });

    return json({
      merges,
      total: parseInt(countResult.rows[0].total, 10),
      limit,
      offset
    });
  } catch (err) {
    console.error('GET /api/admin/merges failed:', err);
    throw error(500, 'Failed to load merge history');
  }
};
