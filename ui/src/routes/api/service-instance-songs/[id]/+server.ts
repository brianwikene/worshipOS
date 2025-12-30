// src/routes/api/service-instance-songs/[id]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `DELETE FROM service_instance_songs WHERE id = $1 RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Song not found in service');
  }

  return json(
    { message: 'Song removed from service', song: result.rows[0] },
    { headers: { 'x-served-by': 'sveltekit' } }
  );
};
