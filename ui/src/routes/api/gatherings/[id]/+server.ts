// /ui/src/routes/api/gatherings/[id]/+server.ts
// This route uses legacy service_* database tables while the API surface and domain language use "gatherings".

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const churchId = event.locals.churchId;
	if (!churchId) throw error(400, 'Active church is required');

	const { id } = event.params;

	try {
		const { data, error: err } = await event.locals.supabase
			.from('service_instances')
			.select(
				`
        id,
        service_time,
        campus_id,
        service_groups!inner (
          name,
          group_date,
          contexts (
            name
          )
        ),
        campuses (
          name
        )
      `
			)
			.eq('id', id)
			.eq('church_id', churchId)
			.single();

		if (err) {
			if (err.code === 'PGRST116') throw error(404, 'Gathering instance not found');
			throw err;
		}

		if (!data) throw error(404, 'Gathering instance not found');

		// Flatten to match legacy SQL output
		// Cast to any to handle potential array inference in TS
		const sg = Array.isArray(data.service_groups)
			? data.service_groups[0]
			: (data.service_groups as any);
		const campus = Array.isArray(data.campuses) ? data.campuses[0] : (data.campuses as any);
		const context = sg?.contexts && Array.isArray(sg.contexts) ? sg.contexts[0] : sg?.contexts;

		const flat = {
			id: data.id,
			service_time: data.service_time,
			campus_id: data.campus_id,
			service_name: sg?.name,
			// Format date to YYYY-MM-DD to match SQL TO_CHAR
			group_date: sg?.group_date,
			context_name: context?.name,
			campus_name: campus?.name
		};

		return json(flat, {
			headers: { 'x-served-by': 'sveltekit' }
		});
	} catch (err: any) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('[API] /api/gatherings/[id] GET', err);
		throw error(500, 'Database error');
	}
};
