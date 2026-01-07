// This route uses legacy service_* database tables while the API surface and domain language use "gatherings".

// src/routes/api/gatherings/[id]/songs/+server.ts

import { pool } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function assertInstanceInChurch(instanceId: string, churchId: string): Promise<boolean> {
	const r = await pool.query(
		`
    SELECT 1
    FROM service_instances si
    WHERE si.id = $1
      AND si.church_id = $2
    `,
		[instanceId, churchId]
	);
	return (r.rowCount ?? 0) > 0;
}

export const POST: RequestHandler = async (event) => {
	// 1. Setup & Input Extraction
	const churchId = event.locals.churchId;
	if (!churchId) throw error(400, 'X-Church-Id is required');

	const { id: instanceId } = event.params;
	const body = await event.request.json();
	const { song_id, display_order, key, notes } = body; // extracted 'notes' here

	// 2. Validation (Must happen BEFORE database write)
	if (!song_id) throw error(400, 'song_id is required');

	const instanceBelongsToChurch = await assertInstanceInChurch(instanceId, churchId);
	if (!instanceBelongsToChurch) throw error(404, 'Gathering instance not found');

	// 3. Execution (The Single Insert)
	const songInsertResult = await pool.query(
		`
    INSERT INTO service_instance_songs
      (church_id, service_instance_id, song_id, display_order, key, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
		[
			churchId,
			instanceId,
			song_id,
			display_order ?? 0,
			key ?? null,
			notes ?? null // ensuring notes are passed safely
		]
	);

	return json(songInsertResult.rows[0], {
		status: 201,
		headers: { 'x-served-by': 'sveltekit' }
	});
};
