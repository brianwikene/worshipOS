import { db } from '$lib/server/db';
import { plans } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) throw error(404, 'Church not found');

	const planData = await db.query.plans.findFirst({
		where: and(eq(plans.id, params.plan_id), eq(plans.church_id, church.id)),
		with: {
			items: {
				with: {
					song: true
				}
			},
			assignments: {
				with: {
					person: true
				}
			},
			campus: true
		}
	});

	if (!planData) {
		throw error(404, 'Plan not found');
	}

	return {
		plan: planData
	};
};

export const actions = {};
