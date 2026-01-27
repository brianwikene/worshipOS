// src/routes/+page.server.ts
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// Fetch Gatherings
	const gatherings = await db.query.gatherings.findMany({
		where: (g, { eq }) => eq(g.church_id, church.id),
		with: {
			instances: true // We need instances for the time/name
		},
		orderBy: (g, { desc }) => [desc(g.date)]
	});

	return { gatherings };
};
