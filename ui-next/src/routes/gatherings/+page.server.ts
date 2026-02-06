// src/routes/gatherings/+page.server.ts
import { db } from '$lib/server/db';
import { campuses, gatherings, plan_items, plans, template_items } from '$lib/server/db/schema';
import { logRequest, logSuccess } from '$lib/server/log';
import { listGatherings } from '$lib/server/services/gatherings';
import { error, fail, redirect } from '@sveltejs/kit';
import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	logRequest(event, '/gatherings load');

	const { church } = event.locals;
	if (!church) throw error(400, 'Active church is required');

	// Delegate to service layer
	const result = await listGatherings(church.id);
	logSuccess(event, '/gatherings load', { count: result.gatherings.length });
	return result;
};

export const actions: Actions = {
	createGathering: async (event) => {
		logRequest(event, '/gatherings createGathering');

		const { church } = event.locals;
		if (!church) throw error(400, 'Active church is required');

		const request = event.request;

		const data = await request.formData();
		const baseTitle = ((data.get('title') as string) || '').trim();
		const startDateStr = ((data.get('start_date') as string) || '').trim();
		const timeStr = ((data.get('time') as string) || '10:00').trim();
		const isSeries = data.get('is_series') === 'on';
		const weekCountRaw = (data.get('week_count') as string) || '1';
		const weekCount = isSeries ? Math.max(1, parseInt(weekCountRaw, 10) || 1) : 1;
		const templateId = data.get('template_id') as string; // From the new dropdown

		if (!baseTitle || !startDateStr) {
			return fail(400, { missing: true });
		}

		let targetCampusId = (data.get('campus_id') as string) || null;
		let timezone = church.timezone || 'America/Los_Angeles';

		// Campus resolution logic
		if (targetCampusId) {
			const c = await db.query.campuses.findFirst({ where: eq(campuses.id, targetCampusId) });
			if (c) timezone = c.timezone;
		} else {
			const existing = await db.query.campuses.findFirst({
				where: eq(campuses.church_id, church.id)
			});
			if (existing) {
				targetCampusId = existing.id;
				timezone = existing.timezone;
			} else {
				const [newCampus] = await db
					.insert(campuses)
					.values({
						church_id: church.id,
						name: 'Main Campus',
						timezone: timezone
					})
					.returning();
				targetCampusId = newCampus.id;
				timezone = newCampus.timezone;
			}
		}

		// This will store the IDs for the redirect
		let firstGatheringId = '';
		let firstPlanId = '';

		await db.transaction(async (tx) => {
			const baseDate = parseISO(startDateStr);

			let templateItemsToClone: (typeof template_items.$inferSelect)[] = [];
			if (templateId) {
				// Use the table object directly if tx.query.template_items is giving trouble
				templateItemsToClone = await tx
					.select()
					.from(template_items)
					.where(eq(template_items.template_id, templateId));
			}

			for (let i = 0; i < weekCount; i++) {
				const currentWeekDate = addDays(baseDate, i * 7);
				const dateString = format(currentWeekDate, 'yyyy-MM-dd');
				const gatheringDateUTC = fromZonedTime(`${dateString} 00:00`, timezone);
				const planDateUTC = fromZonedTime(`${dateString} ${timeStr}`, timezone);
				const gatheringTitle = isSeries ? `${baseTitle} (Week ${i + 1})` : baseTitle;

				const [g] = await tx
					.insert(gatherings)
					.values({
						church_id: church.id,
						campus_id: targetCampusId,
						title: gatheringTitle,
						date: gatheringDateUTC
					})
					.returning({ id: gatherings.id });

				const [p] = await tx
					.insert(plans)
					.values({
						church_id: church.id,
						campus_id: targetCampusId,
						gathering_id: g.id,
						name: format(planDateUTC, 'h:mm a'),
						date: planDateUTC,
						status: 'draft'
					})
					.returning({ id: plans.id });

				if (i === 0) {
					firstGatheringId = g.id;
					firstPlanId = p.id;
				}

				if (templateItemsToClone.length > 0) {
					await tx.insert(plan_items).values(
						templateItemsToClone.map((item) => ({
							church_id: church.id,
							plan_id: p.id,
							title: item.title,
							segment: item.segment as 'pre' | 'core' | 'post',
							order: item.sequence,
							duration: item.duration_seconds,
							description: item.description,
							song_id: item.song_id,
							is_audible: false
						}))
					);
				}
			}
		});

		// 2. Only redirect if we successfully captured the IDs
		if (firstGatheringId && firstPlanId) {
			throw redirect(303, `/gatherings/${firstGatheringId}/plans/${firstPlanId}/order`);
		}

		return { success: true };
	}
};
