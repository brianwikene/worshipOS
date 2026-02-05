// src/routes/gatherings/[gathering_id]/+page.server.ts
// Note: gathering_id currently maps to plan_id (legacy behavior)

import { logRequest, logStep } from '$lib/server/log';
import { getGatheringById } from '$lib/server/services/gatherings';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	logRequest(event, 'page.gatherings.detail.load', { id: event.params.gathering_id });

	const churchId = event.locals.church?.id;
	if (!churchId) throw error(401, 'Unauthorized');

	// Validates gathering exists (throws 404 if not)
	await getGatheringById(churchId, event.params.gathering_id);

	logStep(event, 'redirecting to plan order');
	// Redirect directly to the plan order page
	throw redirect(303, `/gatherings/${event.params.gathering_id}/plans/${event.params.gathering_id}/order`);
};
