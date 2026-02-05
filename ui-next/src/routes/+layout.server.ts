// src/routes/+layout.server.ts

import { db } from '$lib/server/db';
import { campuses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	// ---------------------------------------------------------
	// 1. Authentication (The Floor)
	// ---------------------------------------------------------
	const { session, user } = await locals.safeGetSession();

	// ---------------------------------------------------------
	// 2. Multi-Tenancy (The Context)
	// ---------------------------------------------------------
	const allChurches = await db.query.churches.findMany({
		columns: {
			id: true,
			name: true,
			subdomain: true
		},
		orderBy: (churches, { asc }) => [asc(churches.name)]
	});

	const currentChurch = locals.church;

	let currentCampuses: (typeof campuses.$inferSelect)[] = [];
	let activeCampus: typeof campuses.$inferSelect | null = null;

	if (currentChurch) {
		currentCampuses = await db.query.campuses.findMany({
			where: eq(campuses.church_id, currentChurch.id)
		});

		const campusIdCookie = cookies.get('campus_id');
		if (campusIdCookie) {
			activeCampus = currentCampuses.find((c) => c.id === campusIdCookie) || null;
		}

		if (!activeCampus && currentCampuses.length > 0) {
			activeCampus = currentCampuses[0];
		}
	}

	// ---------------------------------------------------------
	// 3. Identity (WHO AM I)
	// ---------------------------------------------------------
	// actor is set in hooks.server.ts (locals.actor)
	const actor = locals.actor;

	// ---------------------------------------------------------
	// 4. Return Data to Client
	// ---------------------------------------------------------
	return {
		session,
		user,

		// Logged-in person (Brian)
		actor,

		// Tenant context
		church: currentChurch,
		campus: activeCampus,
		allChurches,
		allCampuses: currentCampuses
	};
};
