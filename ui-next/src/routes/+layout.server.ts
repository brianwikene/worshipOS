import { db } from '$lib/server/db';
import { campuses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	// 1. Fetch the first church in the DB
	const churchData = await db.query.churches.findFirst();

	// If no church exists yet (e.g. before seeding), return empty
	if (!churchData) {
		return { church: undefined, campus: null };
	}

	// 2. Fetch the campuses for this church
	const campusList = await db.query.campuses.findMany({
		where: eq(campuses.church_id, churchData.id)
	});

	// 3. Return the data to the UI
	return {
		church: churchData,
		campus: campusList[0] || null, // Default to first campus
		allCampuses: campusList
	};
};
