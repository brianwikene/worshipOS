import { db } from '$lib/server/db';
import { plans } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// 1. Capture the correct parameter based on your folder name [plan_id]
	const { gathering_id, plan_id } = params;

	// 2. Strict Check: If SvelteKit didn't parse them, stop here.
	if (!gathering_id || !plan_id) {
		throw error(400, 'Missing route parameters');
	}

	// 3. Fetch the Plan
	const planData = await db.query.plans.findFirst({
		where: and(
			eq(plans.id, plan_id),
			eq(plans.church_id, church.id),
			eq(plans.gathering_id, gathering_id)
		),
		with: {
			gathering: {
				with: {
					campus: true
				}
			}
		}
	});

	if (!planData) {
		throw error(404, 'Plan not found');
	}

	return {
		plan: planData,
		gathering: planData.gathering
	};
};
