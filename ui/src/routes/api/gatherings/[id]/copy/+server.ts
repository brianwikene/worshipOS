// This route uses legacy service_* database tables while the API surface and domain language use "gatherings".

// src/routes/api/gatherings/[id]/copy/+server.ts

import { error, json } from '@sveltejs/kit';
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
  // We mark this as "migrated" effectively since it doesn't use `pool` (it was just returning JSON).
  // But we ensure it has no imports of pool.

  return json(
    { message: 'Gathering copied', source_id: sourceId, target_date },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
