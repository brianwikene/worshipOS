import { db } from '$lib/server/db';
import { campuses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	// ---------------------------------------------------------
	// 1. Authentication (The Floor)
	// ---------------------------------------------------------
	// Safely retrieve the session from the hooks we just built.
	const { session, user } = await locals.safeGetSession();

	// ---------------------------------------------------------
	// 2. Multi-Tenancy (The Context)
	// ---------------------------------------------------------

	// Fetch ALL churches (For the Dev Toolbar Switcher)
	const allChurches = await db.query.churches.findMany({
		columns: {
			id: true,
			name: true,
			subdomain: true
		},
		orderBy: (churches, { asc }) => [asc(churches.name)]
	});

	// Resolve Current Context (From hooks.server.ts)
	const currentChurch = locals.church;

	let currentCampuses: (typeof campuses.$inferSelect)[] = [];
	let activeCampus = null;

	// If we have a valid church, fetch its campuses
	if (currentChurch) {
		currentCampuses = await db.query.campuses.findMany({
			where: eq(campuses.church_id, currentChurch.id)
		});

		// Resolve Active Campus (Cookie -> Default)
		const campusIdCookie = cookies.get('campus_id');
		if (campusIdCookie) {
			activeCampus = currentCampuses.find((c) => c.id === campusIdCookie) || null;
		}

		// Fallback to first if cookie is invalid or missing
		if (!activeCampus && currentCampuses.length > 0) {
			activeCampus = currentCampuses[0];
		}
	}

	// ---------------------------------------------------------
	// 3. Return Data to Client
	// ---------------------------------------------------------
	return {
		session, // <--- Critical: Auth Session
		user, // <--- Critical: User Info
		person: locals.person, // <--- Critical: Person record with RBAC role
		church: currentChurch,
		campus: activeCampus,
		allChurches,
		allCampuses: currentCampuses
	};
};
