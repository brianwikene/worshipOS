// src/routes/gatherings/[gathering_id]/+page.server.ts
// Note: This route uses gathering_id but actually queries plans directly
// since the schema no longer has a separate gatherings table.

import { db } from '$lib/server/db';
import { plans } from '$lib/server/db/schema';
import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const churchId = locals.church?.id;
	if (!churchId) throw error(401, 'Unauthorized');

	// In the current schema, gathering_id IS the plan_id
	// (plans serve as gatherings directly)
	const plan = await db.query.plans.findFirst({
		where: and(eq(plans.id, params.gathering_id), eq(plans.church_id, churchId)),
		with: {
			campus: true,
			items: {
				columns: { id: true }
			}
		}
	});

	if (!plan) throw error(404, 'Plan not found');

	// Redirect directly to the plan order page
	throw redirect(303, `/gatherings/${params.gathering_id}/plans/${params.gathering_id}/order`);
};
