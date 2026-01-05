// This route uses legacy service_* database tables while the API surface and domain language use "gatherings".

// src/routes/api/gatherings/[id]/songs/[songId]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { songId } = event.params;
  const body = await event.request.json();

  const songUpdateResult = await pool.query(
    `UPDATE service_instance_songs
     SET key = $1, notes = $2, display_order = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [body.key, body.notes, body.display_order, songId]
  );

  if (songUpdateResult.rows.length === 0) {
    throw error(404, 'Song not found in gathering');
  }

  return json(songUpdateResult.rows[0], { headers: { 'x-served-by': 'sveltekit' } });
};

export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { songId } = event.params;

  const songDeleteResult = await pool.query(
    `DELETE FROM service_instance_songs WHERE id = $1 RETURNING *`,
    [songId]
  );

  if (songDeleteResult.rows.length === 0) {
    throw error(404, 'Song not found in gathering');
  }

  return json(
    { message: 'Song removed from gathering', song: songDeleteResult.rows[0] },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
