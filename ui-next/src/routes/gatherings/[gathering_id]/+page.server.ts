// src/routes/gatherings/[gathering_id]/+page.server.ts

import { requirePermission } from '$lib/auth/guards';
import { db } from '$lib/server/db';
import { gatherings, plans } from '$lib/server/db/schema';
import { logRequest, logSuccess } from '$lib/server/log';
import { getGatheringById } from '$lib/server/services/gatherings';
import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

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

export const actions: Actions = {
	addPlan: async (event) => {
		requirePermission({ locals: event.locals, url: event.url }, 'plans:edit');

		logRequest(event, 'page.gatherings.detail.addPlan', { id: event.params.gathering_id });

		const churchId = event.locals.church?.id;
		if (!churchId) throw error(401, 'Unauthorized');

		const gatheringId = event.params.gathering_id;
		if (!gatheringId) throw error(400, 'Missing gathering_id param');

		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { missing: true });

		const gathering = await db.query.gatherings.findFirst({
			where: and(eq(gatherings.id, gatheringId), eq(gatherings.church_id, churchId))
		});

		if (!gathering) throw error(404, 'Gathering not found');

		await db.insert(plans).values({
			church_id: churchId,
			campus_id: gathering.campus_id,
			gathering_id: gatheringId,
			name,
			date: gathering.date,
			status: 'draft'
		});

		logSuccess(event, 'page.gatherings.detail.addPlan', { id: gatheringId, name });

		return { success: true };
	}
};
