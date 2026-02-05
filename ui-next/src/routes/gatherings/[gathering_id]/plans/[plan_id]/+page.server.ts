import { db } from '$lib/server/db';
import { gatherings, plans } from '$lib/server/db/schema';
import { error, redirect } from '@sveltejs/kit'; // Added redirect here
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) throw error(404, 'Church not found');

	// 1. Fetch Gathering details
	const gathering = await db.query.gatherings.findFirst({
		where: and(eq(gatherings.id, params.gathering_id), eq(gatherings.church_id, church.id)),
		with: {
			plans: true,
			campus: true
		}
	});

	if (!gathering) throw error(404, 'Gathering not found');

	// 2. SMART REDIRECT: If we are at the gathering level and there's only one plan,
	// and we aren't already looking at a specific plan_id, redirect to it.
	if (gathering.plans.length === 1 && !params.plan_id) {
		throw redirect(303, `/gatherings/${params.gathering_id}/plans/${gathering.plans[0].id}/order`);
	}

	// 3. Fetch the specific Plan data
	const planData = await db.query.plans.findFirst({
		where: and(eq(plans.id, params.plan_id), eq(plans.church_id, church.id)),
		with: {
			items: {
				with: {
					song: true
				}
			},
			// Make sure your schema uses 'assignments' or 'planPeople'
			// If you renamed this to planPeople earlier, change the key below
			planPeople: {
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
		gathering,
		plan: planData
	};
};

export const actions = {};
