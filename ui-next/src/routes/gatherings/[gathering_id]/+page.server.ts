// src/routes/gatherings/[gathering_id]/+page.server.ts

import { logRequest, logSuccess } from '$lib/server/log';
import { getGatheringById } from '$lib/server/services/gatherings';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	logRequest(event, 'page.gatherings.detail.load', { id: event.params.gathering_id });

	const churchId = event.locals.church?.id;
	if (!churchId) throw error(401, 'Unauthorized');

	const gatheringId = event.params.gathering_id;
	if (!gatheringId) throw error(400, 'Missing gathering_id param');

	// Get gathering with its plans (throws 404 if not found)
	const gathering = await getGatheringById(churchId, gatheringId);

	logSuccess(event, 'page.gatherings.detail.load', {
		id: gatheringId,
		planCount: gathering.plans.length
	});

	return { gathering };
};
