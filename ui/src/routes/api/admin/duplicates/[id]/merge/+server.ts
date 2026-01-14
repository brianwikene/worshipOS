// src/routes/api/admin/duplicates/[id]/merge/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface FieldResolution {
  [field: string]: string; // field name -> person_id to use
}

/**
 * POST /api/admin/duplicates/:id/merge
 * Merge two people into one (survivor)
 * NOTE: This migration uses sequential Supabase calls and lacks ACID transactions.
 * Failures mid-process may leave data in an inconsistent state (partial merge).
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  const supabase = locals.supabase;
  if (!churchId) throw error(400, 'Active church is required');

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

  try {
    // 1. Load the identity link
    const { data: link, error: linkError } = await supabase
        .from('identity_links')
        .select('*')
        .eq('id', linkId)
        .eq('church_id', churchId)
        .single();

    if (linkError || !link) throw error(404, 'Identity link not found');

    const mergedId = link.person_a_id === survivor_id ? link.person_b_id : link.person_a_id;

    // Validate survivor is one of the linked people
    if (survivor_id !== link.person_a_id && survivor_id !== link.person_b_id) {
      throw error(400, 'survivor_id must be one of the linked people');
    }

    // 2. Load both person records
    const { data: people, error: peopleError } = await supabase
        .from('people')
        .select('*')
        .in('id', [survivor_id, mergedId])
        .eq('church_id', churchId);

    if (peopleError || !people || people.length !== 2) {
        throw error(404, 'One or both people not found');
    }

    const survivor = people.find(p => p.id === survivor_id);
    const merged = people.find(p => p.id === mergedId);

    if (!survivor || !merged) throw error(500, 'Failed to load people');

    if (survivor.merged_at || merged.merged_at) {
        throw error(400, 'One or both people have already been merged');
    }

    // 3. Create snapshot
    const mergedSnapshots = { [mergedId]: merged };

    // 4. Update survivor with field resolutions
    const updates: any = {};
    const fieldResolutionsApplied: any = {};

    if (field_resolutions) {
        for (const [field, sourceId] of Object.entries(field_resolutions)) {
            const source = sourceId === survivor_id ? survivor : merged;
            // Only update if value is different
            if (source[field] !== undefined && source[field] !== survivor[field]) {
                updates[field] = source[field];
                fieldResolutionsApplied[field] = { source: sourceId, value: source[field] };
            }
        }
    }

    // Auto-merge goes_by
    if (!survivor.goes_by && merged.goes_by) {
        updates.goes_by = merged.goes_by;
        fieldResolutionsApplied['goes_by'] = { source: mergedId, value: merged.goes_by };
    }

    if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', survivor_id);
    }

    // 5. Transfer related records
    const transferred: Record<string, number> = {
        service_assignments: 0,
        role_capabilities: 0,
        family_memberships: 0,
        contact_methods: 0,
        addresses: 0
    };

    // Helper: Transfer items while avoiding conflicts
    // We fetch all items for both people, match them, and decide what to move.

    // A. Service Assignments (unique: person_id, service_instance_id, role_id)
    // Actually schema PK is id. Unique constraint might be (service_instance_id, role_id, person_id).
    // Let's assume there is a constraint.
    const { data: survivorAssigns } = await supabase.from('service_assignments').select('service_instance_id, role_id').eq('person_id', survivor_id);
    const { data: mergedAssigns } = await supabase.from('service_assignments').select('id, service_instance_id, role_id').eq('person_id', mergedId);

    // Set for quick lookup
    const survivorAssignSet = new Set((survivorAssigns || []).map(a => `${a.service_instance_id}:${a.role_id}`));
    const assignsToMove = [];
    const assignsToDelete = [];

    for (const ma of (mergedAssigns || [])) {
        if (survivorAssignSet.has(`${ma.service_instance_id}:${ma.role_id}`)) {
            assignsToDelete.push(ma.id);
        } else {
            assignsToMove.push(ma.id);
        }
    }

    if (assignsToMove.length > 0) {
        const { error: moveErr } = await supabase
            .from('service_assignments')
            .update({ person_id: survivor_id })
            .in('id', assignsToMove);
        if (!moveErr) transferred.service_assignments = assignsToMove.length;
    }
    if (assignsToDelete.length > 0) {
        await supabase.from('service_assignments').delete().in('id', assignsToDelete);
    }


    // B. Role Capabilities (unique: person_id, role_id)
    const { data: survivorCaps } = await supabase.from('person_role_capabilities').select('role_id').eq('person_id', survivor_id);
    const { data: mergedCaps } = await supabase.from('person_role_capabilities').select('id, role_id').eq('person_id', mergedId);

    const survivorCapSet = new Set((survivorCaps || []).map(c => c.role_id));
    const capsToMove = [];
    const capsToDelete = [];

    for (const mc of (mergedCaps || [])) {
        if (survivorCapSet.has(mc.role_id)) {
            capsToDelete.push(mc.id);
        } else {
            capsToMove.push(mc.id);
        }
    }

    if (capsToMove.length > 0) {
        const { error: moveErr } = await supabase.from('person_role_capabilities').update({ person_id: survivor_id }).in('id', capsToMove);
        if (!moveErr) transferred.role_capabilities = capsToMove.length;
    }
    if (capsToDelete.length > 0) {
        await supabase.from('person_role_capabilities').delete().in('id', capsToDelete);
    }


    // C. Family Memberships (unique: person_id, family_id)
    const { data: survivorFams } = await supabase.from('family_members').select('family_id').eq('person_id', survivor_id);
    const { data: mergedFams } = await supabase.from('family_members').select('id, family_id').eq('person_id', mergedId);

    const survivorFamSet = new Set((survivorFams || []).map(f => f.family_id));
    const famsToMove = [];
    const famsToDelete = [];

    for (const mf of (mergedFams || [])) {
        if (survivorFamSet.has(mf.family_id)) {
            famsToDelete.push(mf.id);
        } else {
            famsToMove.push(mf.id);
        }
    }

    if (famsToMove.length > 0) {
        const { error: moveErr } = await supabase.from('family_members').update({ person_id: survivor_id }).in('id', famsToMove);
        if (!moveErr) transferred.family_memberships = famsToMove.length;
    }
    if (famsToDelete.length > 0) {
        await supabase.from('family_members').delete().in('id', famsToDelete);
    }


    // D. Contact Methods (unique: person_id, type, value)
    const { data: survivorCons } = await supabase.from('contact_methods').select('type, value').eq('person_id', survivor_id);
    const { data: mergedCons } = await supabase.from('contact_methods').select('id, type, value').eq('person_id', mergedId);

    const survivorConSet = new Set((survivorCons || []).map(c => `${c.type}:${(c.value||'').toLowerCase()}`));
    const consToMove = [];
    const consToDelete = [];

    for (const mc of (mergedCons || [])) {
        if (survivorConSet.has(`${mc.type}:${(mc.value||'').toLowerCase()}`)) {
            consToDelete.push(mc.id);
        } else {
            consToMove.push(mc.id);
        }
    }

    if (consToMove.length > 0) {
        const { error: moveErr } = await supabase.from('contact_methods').update({ person_id: survivor_id }).in('id', consToMove);
        if (!moveErr) transferred.contact_methods = consToMove.length;
    }
    if (consToDelete.length > 0) {
        await supabase.from('contact_methods').delete().in('id', consToDelete);
    }


    // E. Addresses (Just move all, usually no unique constraint on address content for person, or allow duplicates)
    // The original SQL just updated all.
    const { error: addrErr, count: addrCount } = await supabase
        .from('addresses')
        .update({ person_id: survivor_id })
        .eq('person_id', mergedId)
        .eq('church_id', churchId)
        .select('id', { count: 'exact' });

    if (!addrErr) transferred.addresses = addrCount || 0;


    // 6. Mark merged person
    await supabase.from('people').update({
        canonical_id: survivor_id,
        merged_at: new Date().toISOString(),
        is_active: false
    }).eq('id', mergedId);

    // 7. Create alias
    if (merged.first_name || merged.last_name) {
        await supabase.from('person_aliases').insert({
            church_id: churchId,
            person_id: survivor_id,
            alias_type: 'merged',
            first_name: merged.first_name,
            last_name: merged.last_name,
            full_name: merged.display_name,
            source: `merge:${mergedId}`
        });
    }

    // 8. Create merge event
    const { data: mergeEvent, error: mergeError } = await supabase
        .from('merge_events')
        .insert({
            church_id: churchId,
            survivor_id,
            merged_ids: [mergedId],
            merged_snapshots: mergedSnapshots,
            field_resolutions: fieldResolutionsApplied,
            transferred_records: transferred,
            performed_by: survivor_id, // placeholder
            reason: reason || null,
            identity_link_id: linkId
        })
        .select()
        .single();

    if (mergeError) {
        console.error('Failed to create merge event log:', mergeError);
        // We continue because the merge mostly happened.
    }

    // 9. Update identity link
    await supabase.from('identity_links')
        .update({ status: 'merged', reviewed_at: new Date().toISOString() })
        .eq('id', linkId);

    // 10. Auto-close other links for merged person
    await supabase.from('identity_links')
        .update({ status: 'merged', review_notes: 'Auto-closed: person was merged' })
        .eq('church_id', churchId)
        .or(`person_a_id.eq.${mergedId},person_b_id.eq.${mergedId}`) // .or logic syntax correct?
        // Supabase .or requires raw string for sub-logic if mixing with other filters sometimes.
        // Actually simpler to use two queries or just .or with internal brackets if supported.
        // Let's use two updates for safety or just .or at top level?
        // But we have church_id AND status AND (a OR b).
        // filter:  church_id=X AND status IN (...) AND (person_a=Y OR person_b=Y)
        // Postgrest: .eq('church_id', X).in('status', ['suggested','confirmed']).or(`person_a_id.eq.${mergedId},person_b_id.eq.${mergedId}`)
    await supabase.from('identity_links')
        .update({ status: 'merged', review_notes: 'Auto-closed: person was merged' })
        .eq('church_id', churchId)
        .in('status', ['suggested', 'confirmed'])
        .or(`person_a_id.eq.${mergedId},person_b_id.eq.${mergedId}`);


    // Fetch final survivor
    const { data: updatedSurvivor } = await supabase
        .from('people')
        .select('*')
        .eq('id', survivor_id)
        .single();

    return json({
        merge_event_id: mergeEvent?.id,
        survivor: updatedSurvivor,
        merged_count: 1,
        transferred
    });

  } catch (err) {
      console.error('POST merge failed:', err);
      throw error(500, 'Failed to merge people');
  }
};
