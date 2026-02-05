// src/routes/api/gatherings/[id]/rehearse/+server.ts
// REST API endpoint for gathering rehearse view (read-only, songs only)

import { logRequest, logSuccess } from '$lib/server/log';
import { getGatheringRehearse } from '$lib/server/services/gatheringRehearse';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	logRequest(event, 'api.gatherings.rehearse', { id: event.params.id });

	const { church } = event.locals;
	if (!church) throw error(401, 'Unauthorized (no active tenant)');

	const id = event.params.id;
	if (!id) throw error(400, 'Missing id param');

	// Read-only: get gathering with songs only
	const rehearse = await getGatheringRehearse(church.id, id);

	logSuccess(event, 'api.gatherings.rehearse', {
		id,
		songCount: rehearse.songs.length
	});

	return json(rehearse);
};
