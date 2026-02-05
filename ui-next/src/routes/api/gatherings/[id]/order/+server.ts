// src/routes/api/gatherings/[id]/order/+server.ts
// REST API endpoint for gathering order/flow (read-only)

import { logRequest, logSuccess } from '$lib/server/log';
import { getGatheringOrder } from '$lib/server/services/gatheringOrder';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	logRequest(event, 'api.gatherings.order', { id: event.params.id });

	const { church } = event.locals;
	if (!church) throw error(401, 'Unauthorized (no active tenant)');

	const id = event.params.id;
	if (!id) throw error(400, 'Missing id param');

	// Read-only: get gathering with plans and items
	const order = await getGatheringOrder(church.id, id);

	logSuccess(event, 'api.gatherings.order', {
		id,
		planCount: order.plans.length,
		totalItems: order.plans.reduce((sum, p) => sum + p.items.length, 0)
	});

	return json(order);
};
