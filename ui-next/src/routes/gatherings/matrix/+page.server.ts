import { db } from '$lib/server/db';
import { gatherings, plan_items, plans } from '$lib/server/db/schema';
import { asc, gte, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// 1. Get Today's Date (UTC Safe) to filter past events
	const today = new Date(); // Use Date object for timestamp comparison

	// 2. Fetch Next 3 Gatherings with FULL Details
	const matrixData = await db.query.gatherings.findMany({
		where: gte(gatherings.date, today),
		orderBy: [asc(gatherings.date)],
		limit: 3,
		with: {
			campus: true,
			plans: {
				limit: 1, // Only grab the first plan for the matrix view
				with: {
					items: {
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
