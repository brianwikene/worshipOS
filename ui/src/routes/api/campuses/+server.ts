// /ui/src/routes/api/campuses/+server.ts
// src/routes/api/campuses/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { data, error: dbError } = await event.locals.supabase
    .from('campuses')
    .select('id, name, location, is_active')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('name');

  if (dbError) {
    console.error('[API] /api/campuses GET failed:', dbError);
    throw error(500, 'Database error');
  }

  return json(data);
};
