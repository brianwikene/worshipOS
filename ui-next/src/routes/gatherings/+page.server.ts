import { db } from '$lib/server/db';
import { gatherings, instances } from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// 1. Get the Default Campus (for the header)
	const defaultCampus = await db.query.campuses.findFirst();

	// 2. Get All Gatherings (The List)
	const data = await db.query.gatherings.findMany({
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

	// The UI expects 'gatherings', so we MUST return 'gatherings'
	return {
		campus: defaultCampus,
		gatherings: data
	};
};

export const actions: Actions = {
	createGathering: async ({ request }) => {
		const data = await request.formData();
		const campusId = data.get('campus_id') as string;
		const baseTitle = data.get('title') as string;
		const startDateStr = data.get('start_date') as string;
		const timeStr = data.get('time') as string;

		// SERIES LOGIC
		const isSeries = data.get('is_series') === 'on';
		const weekCount = isSeries ? parseInt((data.get('week_count') as string) || '1') : 1;

		if (!campusId || !baseTitle || !startDateStr) {
			return fail(400, { missing: true });
		}

		const startDate = new Date(startDateStr);

		// Transaction to create 1 or 8 weeks at once
		await db.transaction(async (tx) => {
			for (let i = 0; i < weekCount; i++) {
				const currentDate = new Date(startDate);
				currentDate.setUTCDate(startDate.getUTCDate() + i * 7);
				const dateString = currentDate.toISOString().split('T')[0];

				const title = isSeries ? `${baseTitle} (Week ${i + 1})` : baseTitle;

				// 1. Create Gathering
				const [newGathering] = await tx
					.insert(gatherings)
					.values({
						campus_id: campusId,
						title: title,
						date: dateString,
						status: 'planning'
					})
					.returning();

				// 2. Create Instance
				await tx.insert(instances).values({
					gathering_id: newGathering.id,
					name: 'Sunday Gathering',
					start_time: timeStr + ':00'
				});
			}
		});

		return { success: true };
	}
};
