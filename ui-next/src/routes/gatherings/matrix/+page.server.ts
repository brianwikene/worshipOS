import { db } from '$lib/server/db';
import { gatherings, instances, plan_items } from '$lib/server/db/schema';
import { asc, gte, isNull } from 'drizzle-orm'; // <--- Added isNull
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// 1. Get Today's Date (UTC Safe) to filter past events
	const today = new Date().toISOString().split('T')[0];

	// 2. Fetch Next 3 Gatherings with FULL Details
	const matrixData = await db.query.gatherings.findMany({
		where: gte(gatherings.date, today),
		orderBy: [asc(gatherings.date)],
		limit: 3,
		with: {
			campus: true,
			instances: {
				orderBy: [asc(instances.start_time)],
				limit: 1,
				with: {
					planItems: {
						// FIX: Filter out deleted items
						where: isNull(plan_items.deleted_at),
						orderBy: [asc(plan_items.sequence)],
						with: {
							song: true,
							person: true
						}
					}
				}
			}
		}
	});

	return {
		gatherings: matrixData
	};
};
