// src/routes/gatherings/[gathering_id]/rehearse/+page.server.ts
// Page loader for gathering rehearse view (read-only, songs only)

import { logRequest, logSuccess } from '$lib/server/log';
import { getGatheringRehearse } from '$lib/server/services/gatheringRehearse';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	logRequest(event, 'page.gatherings.rehearse.load', { id: event.params.gathering_id });

	const churchId = event.locals.church?.id;
	if (!churchId) throw error(401, 'Unauthorized');

	const gatheringId = event.params.gathering_id;
	if (!gatheringId) throw error(400, 'Missing gathering_id param');

	// Read-only: get gathering with songs only
	const rehearse = await getGatheringRehearse(churchId, gatheringId);

	logSuccess(event, 'page.gatherings.rehearse.load', {
		id: gatheringId,
		songCount: rehearse.songs.length
	});

	return { rehearse };
};
