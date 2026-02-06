import { db } from '$lib/server/db';
import { plan_items, plans } from '$lib/server/db/schema';
import { asc, gte, isNull, and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) {
		return { plans: [] };
	}

	// 1. Get Today's Date (UTC Safe) to filter past events
	const today = new Date();

	// 2. Fetch Next 3 Plans with FULL Details
	const matrixData = await db.query.plans.findMany({
		where: and(eq(plans.church_id, church.id), gte(plans.date, today), isNull(plans.deleted_at)),
		orderBy: [asc(plans.date)],
		limit: 3,
		with: {
			campus: true,
			items: {
				orderBy: [asc(plan_items.segment), asc(plan_items.order)],
				with: {
					song: true
				}
			}
		}
	});

	return {
		plans: matrixData
	};
};
