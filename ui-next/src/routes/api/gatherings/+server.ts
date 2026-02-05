// src/routes/api/gatherings/+server.ts
// REST API endpoint for gatherings list

import { logRequest, logSuccess } from '$lib/server/log';
import { listGatherings } from '$lib/server/services/gatherings';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	logRequest(event, 'api.gatherings.list');

	const { church } = event.locals;
	if (!church) throw error(401, 'Unauthorized (no active tenant)');

	const result = await listGatherings(church.id);

	logSuccess(event, 'api.gatherings.list', { count: result.gatherings.length });
	return json(result);
};
