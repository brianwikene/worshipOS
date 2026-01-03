// src/routes/api/gatherings/[id]/songs/[songId]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { songId } = event.params;
  const body = await event.request.json();

  const result = await pool.query(
    `UPDATE service_instance_songs
     SET key = $1, notes = $2, display_order = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [body.key, body.notes, body.display_order, songId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Song not found in service');
  }

  return json(result.rows[0], { headers: { 'x-served-by': 'sveltekit' } });
};

export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { songId } = event.params;

  const result = await pool.query(
    `DELETE FROM service_instance_songs WHERE id = $1 RETURNING *`,
    [songId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Song not found in service');
  }

  return json(
    { message: 'Song removed from service', song: result.rows[0] },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
