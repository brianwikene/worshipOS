// src/routes/gatherings/[gathering_id]/order/+page.server.ts
// Page loader for gathering order/flow view (read-only)

import { logRequest, logSuccess } from '$lib/server/log';
import { getGatheringOrder } from '$lib/server/services/gatheringOrder';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	logRequest(event, 'page.gatherings.order.load', { id: event.params.gathering_id });

	const churchId = event.locals.church?.id;
	if (!churchId) throw error(401, 'Unauthorized');

	const gatheringId = event.params.gathering_id;
	if (!gatheringId) throw error(400, 'Missing gathering_id param');

	// Read-only: get gathering with plans and items
	const order = await getGatheringOrder(churchId, gatheringId);

	logSuccess(event, 'page.gatherings.order.load', {
		id: gatheringId,
		planCount: order.plans.length
	});

	return { order };
};
