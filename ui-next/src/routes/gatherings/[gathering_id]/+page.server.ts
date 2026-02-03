// src/routes/gatherings/[gathering_id]/+page.server.ts

import { db } from '$lib/server/db';
import { gatherings, plans } from '$lib/server/db/schema';
import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

function coerceToDate(value: unknown): Date {
	if (value instanceof Date) return value;
	if (typeof value === 'string' || typeof value === 'number') return new Date(value);
	return new Date(NaN);
}

function defaultStartsAtFromGatheringDate(gatheringDate: unknown): Date {
	const d = coerceToDate(gatheringDate);
	if (Number.isNaN(d.getTime())) return new Date();

	// Default: 10:00 UTC on the gathering day
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return new Date(`${yyyy}-${mm}-${dd}T10:00:00Z`);
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const churchId = locals.church?.id;
	if (!churchId) throw error(401, 'Unauthorized');

	const gathering = await db.query.gatherings.findFirst({
		where: and(eq(gatherings.id, params.gathering_id), eq(gatherings.church_id, churchId)),
		with: {
			plans: {
				with: {
					items: { columns: { id: true } }
				}
			},
			campus: true
		}
	});

	if (!gathering) throw error(404, 'Gathering not found');

	const forceManage = url.searchParams.get('manage') === 'true';
	const onlyPlan = gathering.plans[0];

	if (gathering.plans.length === 1 && onlyPlan?.id && !forceManage) {
		throw redirect(303, `/gatherings/${params.gathering_id}/plans/${onlyPlan.id}/order`);
	}

	return { gathering };
};

export const actions: Actions = {
	addPlan: async ({ request, params, locals }) => {
		const churchId = locals.church?.id;
		if (!churchId) throw error(401, 'Unauthorized');

		const form = await request.formData();
		const title = (form.get('name') as string) || 'Sunday Gathering';

		const gathering = await db.query.gatherings.findFirst({
			where: and(eq(gatherings.id, params.gathering_id), eq(gatherings.church_id, churchId))
		});

		if (!gathering) throw error(404, 'Gathering not found');
		if (!gathering.campus_id) throw error(400, 'Gathering campus is required');

		await db.insert(plans).values({
			church_id: churchId,
			gathering_id: params.gathering_id,
			title,
			campus_id: gathering.campus_id,
			starts_at: defaultStartsAtFromGatheringDate(gathering.date)
		});

		return { success: true };
	}
};
