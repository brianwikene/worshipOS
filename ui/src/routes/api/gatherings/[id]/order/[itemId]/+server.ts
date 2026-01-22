// /ui/src/routes/api/gatherings/[id]/order/[itemId]/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId, itemId } = event.params;
  const body = await event.request.json();

  const allowed: Record<string, any> = {};
  for (const k of [
    'title',
    'duration_seconds',
    'notes',
    'role_id',
    'person_id',
    'related_item_id',
    'sort_order',
    'item_type'
  ]) {
    if (k in body) allowed[k] = body[k];
  }

  const { data, error: dbError } = await event.locals.supabase
    .from('service_items')
    .update(allowed)
    .eq('church_id', churchId)
    .eq('service_instance_id', instanceId)
    .eq('id', itemId)
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

  if (dbError) {
    console.error('PATCH /api/gatherings/[id]/order/[itemId] failed:', dbError);
    throw error(500, 'Failed to update order row');
  }

  return json({
    id: data.id,
    sort_order: data.sort_order,
    item_type: data.item_type,
    title: data.title,
    duration_seconds: data.duration_seconds,
    notes: data.notes,
    role_id: data.role_id,
    role_name: data.role?.name ?? null,
    person_id: data.person_id,
    person_name: data.person?.display_name ?? null,
    related_item_id: data.related_item_id
  });
};

export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId, itemId } = event.params;

  const { error: dbError } = await event.locals.supabase
    .from('service_items')
    .delete()
    .eq('church_id', churchId)
    .eq('service_instance_id', instanceId)
    .eq('id', itemId);

  if (dbError) {
    console.error('DELETE /api/gatherings/[id]/order/[itemId] failed:', dbError);
    throw error(500, 'Failed to delete order row');
  }

  return json({ ok: true });
};
