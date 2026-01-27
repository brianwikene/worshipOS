import { db } from '$lib/server/db';
import { gatherings, instances } from '$lib/server/db/schema';
import { error, fail, redirect } from '@sveltejs/kit'; // <--- Added redirect
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const gathering = await db.query.gatherings.findFirst({
		where: eq(gatherings.id, params.gathering_id),
		with: {
			instances: {
				orderBy: [asc(instances.start_time)],
				with: {
					planItems: { columns: { id: true } }
				}
			},
			campus: true
		}
	});

	if (!gathering) throw error(404, 'Gathering not found');

	// --- SMART REDIRECT LOGIC ---
	// If there is only ONE service time, go straight to the plan.
	// We check specifically for "?manage=true" so you can still force your way
	// back to this dashboard if you need to add a second service time.
	const forceManage = url.searchParams.get('manage') === 'true';

	if (gathering.instances.length === 1 && !forceManage) {
		throw redirect(
			303,
			`/gatherings/${params.gathering_id}/instances/${gathering.instances[0].id}/order`
		);
	}

	return { gathering };
};

export const actions: Actions = {
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
