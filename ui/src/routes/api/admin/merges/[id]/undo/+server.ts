// /ui/src/routes/api/admin/merges/[id]/undo/+server.ts
// src/routes/api/admin/merges/[id]/undo/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/admin/merges/:id/undo
 * Undo a merge, restoring the merged person(s)
 * NOTE: This relies on sequential Supabase calls. No atomic rollback.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  const supabase = locals.supabase;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: mergeId } = params;

  let reason: string | null = null;
  try {
    const body = await request.json();
    reason = body.reason || null;
  } catch {
    // No body or invalid JSON is fine
  }

  try {
    // 1. Load the merge event
    const { data: mergeEvent, error: evtError } = await supabase
        .from('merge_events')
        .select('*')
        .eq('id', mergeId)
        .eq('church_id', churchId)
        .single();

    if (evtError || !mergeEvent) throw error(404, 'Merge event not found');
    if (mergeEvent.undone_at) throw error(400, 'This merge has already been undone');

    const survivorId = mergeEvent.survivor_id;
    const mergedIds: string[] = mergeEvent.merged_ids;
    const snapshots = mergeEvent.merged_snapshots || {};

    const restoredPeople: Array<{ id: string; display_name: string }> = [];

    // 2. Restore each merged person
    for (const mergedId of mergedIds) {
      const snapshot = snapshots[mergedId];
      if (!snapshot) {
        console.warn(`No snapshot found for merged person ${mergedId}`);
        continue;
      }

      const { error: restoreError } = await supabase
        .from('people')
        .update({
            canonical_id: null,
            merged_at: null,
            is_active: true,
            first_name: snapshot.first_name,
            last_name: snapshot.last_name,
            goes_by: snapshot.goes_by,
            display_name: snapshot.display_name,
            updated_at: new Date().toISOString()
        })
        .eq('id', mergedId);

      if (restoreError) {
          console.error(`Failed to restore person ${mergedId}:`, restoreError);
          // Continue best effort? Or stop?
          // Stop to avoid partial state if possible.
          throw error(500, 'Failed to restore merged person');
      }

      restoredPeople.push({
        id: mergedId,
        display_name: snapshot.display_name
      });
    }

    // 3. Remove "merged" alias from survivor
    // source LIKE 'merge:%'
    await supabase
        .from('person_aliases')
        .delete()
        .eq('person_id', survivorId)
        .ilike('source', 'merge:%');

    // 4. Reopen identity link
    if (mergeEvent.identity_link_id) {
        // We need to append to review_notes.
        // Reading it first is safest since we can't do string concat in update easily?
        // Actually, let's just overwrite or assume we can set it.
        // Or fetch first.
        const { data: link } = await supabase
            .from('identity_links')
            .select('review_notes')
            .eq('id', mergeEvent.identity_link_id)
            .single();

        const currentNotes = link?.review_notes || '';
        const newNotes = (currentNotes ? currentNotes + '\n' : '') + 'Merge was undone';

        await supabase
            .from('identity_links')
            .update({
                status: 'confirmed', // Revert to confirmed? Or suggested? Original code used confirmed.
                review_notes: newNotes
            })
            .eq('id', mergeEvent.identity_link_id);
    }

    // 5. Mark merge event as undone
    const { error: undoError } = await supabase
        .from('merge_events')
        .update({
            undone_at: new Date().toISOString(),
            undone_by: survivorId, // placeholder
            undo_reason: reason
        })
        .eq('id', mergeId);

    if (undoError) {
        throw error(500, 'Failed to update merge event status');
    }

    return json({
      success: true,
      restored_people: restoredPeople,
      note: 'Transferred records (assignments, capabilities, etc.) remain with the survivor. Reassign manually if needed.'
    });

  } catch (err) {
      console.error('POST merge undo failed:', err);
      // Retrow if it's already an HTTP error object
      if (err && typeof err === 'object' && 'status' in err) throw err;
      throw error(500, 'Failed to undo merge');
  }
};
