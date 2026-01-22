// /ui/src/routes/api/admin/merges/+server.ts
// src/routes/api/admin/merges/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const includeUndone = url.searchParams.get('include_undone') === 'true';

  let query = locals.supabase
    .from('merge_events')
    .select(`
        id,
        survivor_id,
        merged_ids,
        field_resolutions,
        transferred_records,
        performed_at,
        reason,
        undone_at,
        undo_reason,
        merged_snapshots,
        survivor:people!survivor_id(display_name),
        performer:people!performed_by(display_name),
        undoer:people!undone_by(display_name)
    `, { count: 'exact' })
    .eq('church_id', churchId)
    .order('performed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeUndone) {
    query = query.is('undone_at', null);
  }

  const { data, count, error: dbError } = await query;

  if (dbError) {
    console.error('GET /api/admin/merges failed:', dbError);
    throw error(500, 'Failed to load merge history');
  }

  const merges = (data || []).map((row: any) => {
    // Extract merged names from snapshots
    const snapshots = row.merged_snapshots || {};
    const mergedNames = (row.merged_ids || []).map((id: string) => {
      const snapshot = snapshots[id];
      return snapshot?.display_name || 'Unknown';
    });

    return {
      id: row.id,
      survivor_id: row.survivor_id,
      survivor_name: row.survivor?.display_name || 'Unknown',
      merged_ids: row.merged_ids,
      merged_names: mergedNames,
      merged_count: (row.merged_ids || []).length,
      field_resolutions: row.field_resolutions,
      transferred_records: row.transferred_records,
      performed_by: row.performer?.display_name,
      performed_at: row.performed_at,
      reason: row.reason,
      can_undo: !row.undone_at,
      undone_at: row.undone_at,
      undone_by: row.undoer?.display_name,
      undo_reason: row.undo_reason
    };
  });

  return json({
    merges,
    total: count || 0,
    limit,
    offset
  });
};
