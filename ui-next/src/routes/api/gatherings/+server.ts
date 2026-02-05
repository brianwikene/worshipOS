// src/routes/api/gatherings/+server.ts
// REST API endpoint for gatherings

import { logRequest, logSuccess } from '$lib/server/log';
import { listGatherings } from '$lib/server/services/gatherings';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	logRequest(event, 'api.gatherings.list');

	const { church } = event.locals;

	if (!church) {
		return json({ error: 'Active church is required' }, { status: 400 });
	}

	const result = await listGatherings(church.id);

	logSuccess(event, 'api.gatherings.list', { count: result.gatherings.length });
	return json(result);
};
