// POST /api/admin/duplicates/[id]/merge - Merge two people

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

interface FieldResolution {
  [field: string]: string; // field name -> person_id to use
}

/**
 * POST /api/admin/duplicates/:id/merge
 * Merge two people into one (survivor)
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: linkId } = params;
  const body = await request.json();
  const { survivor_id, field_resolutions, reason } = body as {
    survivor_id: string;
    field_resolutions?: FieldResolution;
    reason?: string;
  };

  if (!survivor_id) {
    throw error(400, 'survivor_id is required');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Load the identity link
    const linkResult = await client.query(
      `SELECT * FROM identity_links WHERE id = $1 AND church_id = $2`,
      [linkId, churchId]
    );

    if (linkResult.rows.length === 0) {
      throw error(404, 'Identity link not found');
    }

    const link = linkResult.rows[0];
    const mergedId = link.person_a_id === survivor_id ? link.person_b_id : link.person_a_id;

    // Validate survivor is one of the linked people
    if (survivor_id !== link.person_a_id && survivor_id !== link.person_b_id) {
      throw error(400, 'survivor_id must be one of the linked people');
    }

    // 2. Load both person records with all their data
    const peopleResult = await client.query(
      `SELECT
        p.*,
        COALESCE(
          (SELECT json_agg(cm.*) FROM contact_methods cm WHERE cm.person_id = p.id),
          '[]'
        ) as contact_methods,
        COALESCE(
          (SELECT json_agg(fm.*) FROM family_members fm WHERE fm.person_id = p.id),
          '[]'
        ) as family_memberships,
        COALESCE(
          (SELECT json_agg(prc.*) FROM person_role_capabilities prc WHERE prc.person_id = p.id),
          '[]'
        ) as role_capabilities
      FROM people p
      WHERE p.id = ANY($1) AND p.church_id = $2`,
      [[survivor_id, mergedId], churchId]
    );

    if (peopleResult.rows.length !== 2) {
      throw error(404, 'One or both people not found');
    }

    const survivor = peopleResult.rows.find(p => p.id === survivor_id);
    const merged = peopleResult.rows.find(p => p.id === mergedId);

    if (!survivor || !merged) {
      throw error(500, 'Failed to load people');
    }

    // Check if either is already merged
    if (survivor.merged_at || merged.merged_at) {
      throw error(400, 'One or both people have already been merged');
    }

    // 3. Create snapshot of merged record
    const mergedSnapshots = {
      [mergedId]: merged
    };

    // 4. Apply field resolutions to survivor
    const fieldResolutionsApplied: Record<string, { source: string; value: unknown }> = {};
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIdx = 1;

    if (field_resolutions) {
      for (const [field, sourceId] of Object.entries(field_resolutions)) {
        const source = sourceId === survivor_id ? survivor : merged;
        const value = source[field];

        if (value !== undefined && value !== survivor[field]) {
          updateFields.push(`${field} = $${paramIdx++}`);
          updateValues.push(value);
          fieldResolutionsApplied[field] = { source: sourceId, value };
        }
      }
    }

    // Always take goes_by from merged if survivor doesn't have one
    if (!survivor.goes_by && merged.goes_by) {
      updateFields.push(`goes_by = $${paramIdx++}`);
      updateValues.push(merged.goes_by);
      fieldResolutionsApplied['goes_by'] = { source: mergedId, value: merged.goes_by };
    }

    // Update survivor if there are field changes
    if (updateFields.length > 0) {
      updateValues.push(survivor_id);
      await client.query(
        `UPDATE people SET ${updateFields.join(', ')}, updated_at = now()
         WHERE id = $${paramIdx}`,
        updateValues
      );
    }

    // 5. Transfer related records
    const transferred: Record<string, number> = {};

    // Transfer service assignments
    const assignResult = await client.query(
      `UPDATE service_assignments SET person_id = $1
       WHERE person_id = $2 AND church_id = $3`,
      [survivor_id, mergedId, churchId]
    );
    transferred.service_assignments = assignResult.rowCount || 0;

    // Transfer role capabilities (skip duplicates)
    const capResult = await client.query(
      `UPDATE person_role_capabilities
       SET person_id = $1
       WHERE person_id = $2 AND church_id = $3
         AND role_id NOT IN (
           SELECT role_id FROM person_role_capabilities WHERE person_id = $1
         )`,
      [survivor_id, mergedId, churchId]
    );
    transferred.role_capabilities = capResult.rowCount || 0;

    // Delete duplicate capabilities that couldn't be transferred
    await client.query(
      `DELETE FROM person_role_capabilities WHERE person_id = $1 AND church_id = $2`,
      [mergedId, churchId]
    );

    // Transfer family memberships (skip duplicates)
    const famResult = await client.query(
      `UPDATE family_members
       SET person_id = $1
       WHERE person_id = $2
         AND family_id NOT IN (
           SELECT family_id FROM family_members WHERE person_id = $1
         )`,
      [survivor_id, mergedId]
    );
    transferred.family_memberships = famResult.rowCount || 0;

    // Delete duplicate family memberships
    await client.query(
      `DELETE FROM family_members WHERE person_id = $1`,
      [mergedId]
    );

    // Transfer contact methods (skip exact duplicates)
    const cmResult = await client.query(
      `UPDATE contact_methods
       SET person_id = $1
       WHERE person_id = $2 AND church_id = $3
         AND (type, LOWER(value)) NOT IN (
           SELECT type, LOWER(value) FROM contact_methods WHERE person_id = $1
         )`,
      [survivor_id, mergedId, churchId]
    );
    transferred.contact_methods = cmResult.rowCount || 0;

    // Delete duplicate contact methods
    await client.query(
      `DELETE FROM contact_methods WHERE person_id = $1 AND church_id = $2`,
      [mergedId, churchId]
    );

    // Transfer addresses
    const addrResult = await client.query(
      `UPDATE addresses SET person_id = $1 WHERE person_id = $2 AND church_id = $3`,
      [survivor_id, mergedId, churchId]
    );
    transferred.addresses = addrResult.rowCount || 0;

    // 6. Mark merged person as merged
    await client.query(
      `UPDATE people SET canonical_id = $1, merged_at = now(), is_active = false
       WHERE id = $2`,
      [survivor_id, mergedId]
    );

    // 7. Create person alias from merged name
    if (merged.first_name || merged.last_name) {
      await client.query(
        `INSERT INTO person_aliases
          (church_id, person_id, alias_type, first_name, last_name, full_name, source)
         VALUES ($1, $2, 'merged', $3, $4, $5, $6)`,
        [
          churchId,
          survivor_id,
          merged.first_name,
          merged.last_name,
          merged.display_name,
          `merge:${mergedId}`
        ]
      );
    }

    // 8. Create merge event for audit trail
    // TODO: Get actual user ID from session
    const performedBy = survivor_id; // Placeholder

    const mergeResult = await client.query(
      `INSERT INTO merge_events
        (church_id, survivor_id, merged_ids, merged_snapshots, field_resolutions,
         transferred_records, performed_by, reason, identity_link_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        churchId,
        survivor_id,
        [mergedId],
        JSON.stringify(mergedSnapshots),
        JSON.stringify(fieldResolutionsApplied),
        JSON.stringify(transferred),
        performedBy,
        reason || null,
        linkId
      ]
    );

    // 9. Update identity link status
    await client.query(
      `UPDATE identity_links SET status = 'merged', reviewed_at = now()
       WHERE id = $1`,
      [linkId]
    );

    // 10. Update any other identity links involving the merged person
    await client.query(
      `UPDATE identity_links
       SET status = 'merged', review_notes = 'Auto-closed: person was merged'
       WHERE church_id = $1
         AND (person_a_id = $2 OR person_b_id = $2)
         AND status IN ('suggested', 'confirmed')`,
      [churchId, mergedId]
    );

    await client.query('COMMIT');

    // Load updated survivor
    const updatedResult = await pool.query(
      `SELECT * FROM people WHERE id = $1`,
      [survivor_id]
    );

    return json({
      merge_event_id: mergeResult.rows[0].id,
      survivor: updatedResult.rows[0],
      merged_count: 1,
      transferred
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('POST /api/admin/duplicates/:id/merge failed:', err);
    throw error(500, 'Failed to merge people');
  } finally {
    client.release();
  }
};
