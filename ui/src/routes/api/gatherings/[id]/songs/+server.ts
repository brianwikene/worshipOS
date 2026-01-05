// This route uses legacy service_* database tables while the API surface and domain language use "gatherings".

// src/routes/api/gatherings/[id]/songs/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

async function assertInstanceInChurch(instanceId: string, churchId: string): Promise<boolean> {
  const instanceLookupResult = await pool.query(
    `
    SELECT 1
    FROM service_instances si
    JOIN service_groups sg ON sg.id = si.service_group_id
    WHERE si.id = $1 AND sg.church_id = $2
    `,
    [instanceId, churchId]
  );
  return (instanceLookupResult.rowCount ?? 0) > 0;
}

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId } = event.params;

  const songsResult = await pool.query(
    `SELECT
      sis.*,
      s.title,
      s.artist,
      s.key as default_key,
      s.bpm,
      s.ccli_number
     FROM service_instance_songs sis
     JOIN service_instances si ON si.id = sis.service_instance_id
     JOIN service_groups sg ON sg.id = si.service_group_id
     JOIN songs s ON s.id = sis.song_id
     WHERE sis.service_instance_id = $1
       AND sg.church_id = $2
     ORDER BY sis.display_order`,
    [instanceId, churchId]
  );

  return json(songsResult.rows, {
    headers: { 'x-served-by': 'sveltekit' }
  });
};

export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId } = event.params;
  const body = await event.request.json();
  const { song_id, display_order, key, notes } = body;

  if (!song_id) {
    throw error(400, 'song_id is required');
  }

  const instanceBelongsToChurch = await assertInstanceInChurch(instanceId, churchId);
  if (!instanceBelongsToChurch) {
    throw error(404, 'Gathering instance not found');
  }

  const songInsertResult = await pool.query(
    `INSERT INTO service_instance_songs
       (service_instance_id, song_id, display_order, key, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
    [instanceId, song_id, display_order, key, notes]
  );

  return json(songInsertResult.rows[0], {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};
