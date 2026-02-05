// src/routes/api/gatherings/[id]/+server.ts
// REST API endpoint for single gathering detail

import { logRequest, logSuccess } from '$lib/server/log';
import { getGatheringById } from '$lib/server/services/gatherings';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	logRequest(event, 'api.gatherings.detail', { id: event.params.id });

	const { church } = event.locals;
	if (!church) throw error(401, 'Unauthorized (no active tenant)');

	const id = event.params.id;
	if (!id) throw error(400, 'Missing id param');

	// Throws 404 if not found
	const gathering = await getGatheringById(church.id, id);

	logSuccess(event, 'api.gatherings.detail', { id, planCount: gathering.plans.length });
	return json(gathering);
};
