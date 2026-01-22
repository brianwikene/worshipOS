// /ui/src/routes/api/gatherings/[id]/order/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type ItemType = 'header' | 'item' | 'note';

function assertItemType(t: any): t is ItemType {
  return t === 'header' || t === 'item' || t === 'note';
}

// GET: return all non-song service_items for this instance (headers/items/notes)
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId } = event.params;

  const { data, error: dbError } = await event.locals.supabase
    .from('service_items')
    .select(
      `
      id,
      church_id,
      service_instance_id,
      sort_order,
      item_type,
      title,
      duration_seconds,
      notes,
      role_id,
      person_id,
      related_item_id,
      role:roles(name),
      person:people(display_name)
    `
    )
    .eq('church_id', churchId)
    .eq('service_instance_id', instanceId)
    .neq('item_type', 'song')
    .order('sort_order', { ascending: true });

  if (dbError) {
    console.error('GET /api/gatherings/[id]/order failed:', dbError);
    throw error(500, 'Failed to load order items');
  }

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    sort_order: r.sort_order,
    item_type: r.item_type,
    title: r.title,
    duration_seconds: r.duration_seconds,
    notes: r.notes,
    role_id: r.role_id,
    role_name: r.role?.name ?? null,
    person_id: r.person_id,
    person_name: r.person?.display_name ?? null,
    related_item_id: r.related_item_id
  }));

  return json(rows, { headers: { 'x-served-by': 'sveltekit' } });
};

// POST: create a new header/item/note.
// Supports inserting after a specific item (shifts sort_order to keep adjacency).
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId } = event.params;
  const body = await event.request.json();

  const {
    item_type,
    title,
    duration_seconds,
    notes,
    role_id,
    person_id,
    related_item_id,
    after_item_id
  } = body;

  if (!assertItemType(item_type)) throw error(400, 'Invalid item_type');

  // ensure instance exists (tenancy-safe)
  const { count } = await event.locals.supabase
    .from('service_instances')
    .select('id', { count: 'exact', head: true })
    .eq('id', instanceId)
    .eq('church_id', churchId);

  if (!count) throw error(404, 'Gathering instance not found');

  // Determine sort_order: append by default, or insert after a row.
  let insertAfterSort: number | null = null;

  if (after_item_id) {
    const { data: afterRow, error: afterErr } = await event.locals.supabase
      .from('service_items')
      .select('id, sort_order')
      .eq('church_id', churchId)
      .eq('service_instance_id', instanceId)
      .eq('id', after_item_id)
      .single();

    if (afterErr || !afterRow) throw error(400, 'Invalid after_item_id');
    insertAfterSort = afterRow.sort_order;
  }

  // If inserting after, shift everything after that point +1
  if (insertAfterSort !== null) {
    const { error: shiftErr } = await event.locals.supabase
      .from('service_items')
      .update({ sort_order: event.locals.supabase.rpc ? undefined : undefined }); // placeholder
  }

  // Supabase can't do "sort_order = sort_order + 1" via update object.
  // Use RPC if you have one; otherwise do two-step client-side.
  // Here’s the safe approach: fetch IDs to shift, then update them.
  if (insertAfterSort !== null) {
    const { data: toShift, error: listErr } = await event.locals.supabase
      .from('service_items')
      .select('id, sort_order')
      .eq('church_id', churchId)
      .eq('service_instance_id', instanceId)
      .gt('sort_order', insertAfterSort)
      .order('sort_order', { ascending: false }); // update from bottom to avoid collisions

    if (listErr) throw error(500, 'Failed to insert row');

    for (const row of toShift ?? []) {
      const { error: updErr } = await event.locals.supabase
        .from('service_items')
        .update({ sort_order: row.sort_order + 1 })
        .eq('id', row.id)
        .eq('church_id', churchId);
      if (updErr) throw error(500, 'Failed to insert row');
    }
  }

  // If appending, find max sort_order and +1
  let sort_order: number;
  if (insertAfterSort === null) {
    const { data: maxRow, error: maxErr } = await event.locals.supabase
      .from('service_items')
      .select('sort_order')
      .eq('church_id', churchId)
      .eq('service_instance_id', instanceId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) throw error(500, 'Failed to create row');
    sort_order = (maxRow?.sort_order ?? 0) + 1;
  } else {
    sort_order = insertAfterSort + 1;
  }

  const { data: created, error: insErr } = await event.locals.supabase
    .from('service_items')
    .insert({
      church_id: churchId,
      service_instance_id: instanceId,
      sort_order,
      item_type,
      title: title ?? null,
      duration_seconds: duration_seconds ?? null,
      notes: notes ?? null,
      role_id: role_id ?? null,
      person_id: person_id ?? null,
      related_item_id: related_item_id ?? null
    })
    .select(
      `
      id,
      sort_order,
      item_type,
      title,
      duration_seconds,
      notes,
      role_id,
      person_id,
      related_item_id,
      role:roles(name),
      person:people(display_name)
    `
    )
    .single();

  if (insErr) {
    console.error('POST /api/gatherings/[id]/order failed:', insErr);
    throw error(500, 'Failed to create order row');
  }

  return json(
    {
      id: created.id,
      sort_order: created.sort_order,
      item_type: created.item_type,
      title: created.title,
      duration_seconds: created.duration_seconds,
      notes: created.notes,
      role_id: created.role_id,
      role_name: created.role?.name ?? null,
      person_id: created.person_id,
      person_name: created.person?.display_name ?? null,
      related_item_id: created.related_item_id
    },
    { status: 201, headers: { 'x-served-by': 'sveltekit' } }
  );
};
