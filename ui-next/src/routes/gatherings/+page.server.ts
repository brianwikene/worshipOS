// src/routes/gatherings/+page.server.ts
import { db } from '$lib/server/db';
import { campuses, gatherings, instances } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const churchId = locals.church?.id;
	if (!churchId) throw error(400, 'Active church is required');

	// 1) Default Campus (for the header)
	const defaultCampus = await db.query.campuses.findFirst({
		where: eq(campuses.church_id, churchId),
		orderBy: asc(campuses.name)
	});

	// 2) Gatherings list (scoped to tenant)
	const data = await db.query.gatherings.findMany({
		where: eq(gatherings.church_id, churchId),
		orderBy: [asc(gatherings.date)],
		with: {
			campus: true,
			instances: {
				orderBy: (instances, { asc }) => [asc(instances.start_time)],
				with: {
					planItems: {
						columns: { id: true }
					}
				}
			}
		}
	});

	return {
		campus: defaultCampus,
		gatherings: data
	};
};

export const actions: Actions = {
	createGathering: async ({ request, locals }) => {
		const churchId = locals.church?.id;
		if (!churchId) throw error(400, 'Active church is required');

		const data = await request.formData();
		const campusId = (data.get('campus_id') as string) || '';
		const baseTitle = (data.get('title') as string) || '';
		const startDateStr = (data.get('start_date') as string) || '';
		const timeStr = (data.get('time') as string) || '09:00';

		// SERIES LOGIC
		const isSeries = data.get('is_series') === 'on';
		const weekCount = isSeries ? parseInt((data.get('week_count') as string) || '1', 10) : 1;

		if (!campusId || !baseTitle || !startDateStr) {
			return fail(400, { missing: true });
		}

		const startDate = new Date(startDateStr);

		await db.transaction(async (tx) => {
			for (let i = 0; i < weekCount; i++) {
				const currentDate = new Date(startDate);
				currentDate.setUTCDate(startDate.getUTCDate() + i * 7);
				const dateString = currentDate.toISOString().split('T')[0];

				const title = isSeries ? `${baseTitle} (Week ${i + 1})` : baseTitle;

				// 1) Create Gathering (tenant-scoped)
				const gatheringInsert = {
					church_id: churchId,
					campus_id: campusId,
					title,
					date: dateString,
					status: 'planning'
				} satisfies typeof gatherings.$inferInsert;

				const [newGathering] = await tx.insert(gatherings).values(gatheringInsert).returning();

				// 2) Create Instance
				const instanceInsert = {
					gathering_id: newGathering.id,
					name: 'Sunday Gathering',
					start_time: timeStr + ':00'
				} satisfies typeof instances.$inferInsert;

				await tx.insert(instances).values(instanceInsert);
			}
		});

		return { success: true };
	}
};
