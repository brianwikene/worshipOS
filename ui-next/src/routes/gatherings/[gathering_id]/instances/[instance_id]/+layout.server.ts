import { db } from '$lib/server/db';
import { instances } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';

export const load = async ({ params }) => {
	// 1. Fetch the specific Instance requested
	const instanceData = await db.query.instances.findFirst({
		where: eq(instances.id, params.instance_id),
		with: {
			gathering: true // Get parent details (Date, Title)
		}
	});

	if (!instanceData) error(404, 'Instance not found');

	// 2. Fetch "Siblings" (Other instances for this same gathering)
	// This enables the "Copy to 11am" features later
	const otherInstances = await db.query.instances.findMany({
		where: and(
			eq(instances.gathering_id, instanceData.gathering_id),
			ne(instances.id, instanceData.id) // Exclude self
		),
		orderBy: (instances, { asc }) => [asc(instances.start_time)]
	});

	return {
		instance: instanceData,
		gathering: instanceData.gathering,
		siblings: otherInstances
	};
};
