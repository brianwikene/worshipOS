import { db } from '$lib/server/db';
import { gatherings, instances } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const gathering = await db.query.gatherings.findFirst({
		where: eq(gatherings.id, params.gathering_id),
		with: {
			instances: {
				orderBy: [asc(instances.start_time)],
				with: {
					// Count items to show "Empty Plan" vs "Ready"
					planItems: { columns: { id: true } }
				}
			},
			campus: true
		}
	});

	if (!gathering) throw error(404, 'Gathering not found');

	return { gathering };
};

export const actions: Actions = {
	// Feature: Add another service time (e.g. 11:00 AM) to this existing gathering
	addInstance: async ({ request, params }) => {
		const data = await request.formData();
		const timeStr = data.get('time') as string;
		const name = (data.get('name') as string) || 'Service';

		if (!timeStr) return fail(400, { missing: true });

		await db.insert(instances).values({
			gathering_id: params.gathering_id,
			name: name,
			start_time: timeStr + ':00'
		});

		return { success: true };
	}
};
