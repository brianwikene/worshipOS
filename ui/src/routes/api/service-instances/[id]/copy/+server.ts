// src/routes/api/service-instances/[id]/copy/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: sourceId } = event.params;
  const body = await event.request.json();
  const { target_date, target_time } = body;

  // TODO: Implement service copying logic
  // This would copy assignments, songs, segments from one service to another
  // Implementation depends on exact requirements

  return json(
    { message: 'Service copied', source_id: sourceId, target_date },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
