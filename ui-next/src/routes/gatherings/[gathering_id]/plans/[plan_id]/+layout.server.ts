import { db } from '$lib/server/db';
import { plans } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) throw error(404, 'Church not found');

	const { plan_id } = params;

	if (!plan_id) {
		throw error(400, 'Missing route parameters');
	}

	// Fetch the Plan with gathering and campus info
	const planData = await db.query.plans.findFirst({
		where: and(eq(plans.id, plan_id), eq(plans.church_id, church.id)),
		with: {
			campus: true,
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
		plan: planData
	};
};
