// /ui/src/routes/api/gatherings/+server.ts
// src/routes/api/gatherings/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function normalizeTimeToHHMMSS(input: string): string {
	// Accept "HH:MM" or "HH:MM:SS"
	if (!input || typeof input !== 'string') return '';
	const t = input.trim();

	// HH:MM:SS
	if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;

	// HH:MM
	if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;

	return '';
}

export const GET: RequestHandler = async (event) => {
	const churchId = event.locals.churchId;
	if (!churchId) throw error(400, 'Active church is required');

	const url = event.url;
	const startDate = url.searchParams.get('start_date');
	const endDate = url.searchParams.get('end_date');

	let query = event.locals.supabase
		.from('service_groups')
		.select(
			`
      id,
      group_date,
      name,
      context:contexts(name),
      instances:service_instances(
        id,
        service_time,
        campus:campuses(name)
      )
    `
		)
		.eq('church_id', churchId)
		.order('group_date', { ascending: true });

	if (startDate) query = query.gte('group_date', startDate);
	if (endDate) query = query.lte('group_date', endDate);

	const { data: groups, error: dbError } = await query;

	if (dbError) {
		console.error('GET /api/gatherings failed:', dbError);
		throw error(500, dbError.message);
	}

	const formattedGroups = (groups ?? []).map((g: any) => ({
		id: g.id,
		group_date: g.group_date,
		name: g.name,
		context_name: g.context?.name || 'Unknown',
		instances: (g.instances ?? [])
			.sort((a: any, b: any) => String(a.service_time).localeCompare(String(b.service_time)))
			.map((i: any) => ({
				id: i.id,
				service_time: i.service_time,
				campus_name: i.campus?.name ?? null,
				assignments: {
					total_positions: 0,
					filled_positions: 0,
					confirmed: 0,
					pending: 0,
					unfilled: 0,
					by_ministry: []
				}
			}))
	}));

	return json(formattedGroups, {
		headers: { 'x-served-by': 'sveltekit' }
	});
};

// POST - Create a new gathering
export const POST: RequestHandler = async (event) => {
	const churchId = event.locals.churchId;
	if (!churchId) throw error(400, 'Active church is required');

	const body = await event.request.json().catch(() => ({}));

	const name = body?.name;
	const context_id = body?.context_id ?? null;
	const group_date = body?.group_date;

	// Normalize to arrays so downstream logic is stable
	const instancesRaw = Array.isArray(body?.instances) ? body.instances : [];
	const positionsRaw = Array.isArray(body?.positions) ? body.positions : [];

	if (!name || !group_date || instancesRaw.length === 0) {
		throw error(400, 'name, group_date, and at least one instance are required');
	}

	// Validate date - allow today or future (keep your grace logic)
	const serviceDate = new Date(group_date + 'T00:00:00');
	const now = new Date();
	const gracePeriod = new Date(now.getTime() - 2 * 60 * 60 * 1000);
	gracePeriod.setHours(0, 0, 0, 0);

	if (serviceDate < gracePeriod) {
		throw error(400, 'Gathering date must be today or in the future');
	}

	// Validate + normalize instances
	const instances = instancesRaw.map((inst: any) => {
		const service_time = normalizeTimeToHHMMSS(inst?.service_time);
		if (!service_time) throw error(400, 'instances[].service_time must be HH:MM or HH:MM:SS');

		return {
			church_id: churchId,
			service_group_id: '', // fill after group insert
			service_date: group_date,
			service_time,
			campus_id: inst?.campus_id ?? null
		};
	});

	// 1) Create the Gathering group
	const { data: group, error: groupError } = await event.locals.supabase
		.from('service_groups')
		.insert({
			church_id: churchId,
			group_date,
			name,
			context_id
		})
		.select('id')
		.single();

	if (groupError || !group?.id) {
		console.error('Error creating Gathering group:', groupError);
		throw error(500, 'Failed to create gathering');
	}

	const groupId = group.id;

	// 2) Bulk create Gathering instances
	const instancesToInsert = instances.map((i) => ({ ...i, service_group_id: groupId }));

	const { data: createdInstances, error: instError } = await event.locals.supabase
		.from('service_instances')
		.insert(instancesToInsert)
		.select('id');

	if (instError) {
		console.error('Error creating instances:', instError);

		// Best-effort cleanup to reduce orphan groups
		await event.locals.supabase.from('service_groups').delete().eq('id', groupId);

		throw error(500, 'Failed to create service instances');
	}

	const instanceIds = (createdInstances ?? []).map((r: any) => r.id);

	// 3) Create position assignments (optional)
	if (positionsRaw.length > 0 && instanceIds.length > 0) {
		const assignmentsToInsert: any[] = [];

		for (const instanceId of instanceIds) {
			for (const pos of positionsRaw) {
				const qty = Math.max(1, Number(pos?.quantity ?? 1));
				const roleId = pos?.role_id;
				if (!roleId) continue;

				for (let i = 0; i < qty; i++) {
					assignmentsToInsert.push({
						church_id: churchId,
						service_instance_id: instanceId,
						role_id: roleId,
						status: 'pending'
					});
				}
			}
		}

		if (assignmentsToInsert.length > 0) {
			const { error: assignError } = await event.locals.supabase
				.from('service_assignments')
				.insert(assignmentsToInsert);

			if (assignError) {
				console.error('Error creating assignments:', assignError);
				// Intentionally non-fatal: gathering exists; needs can be added later.
			}
		}
	}

	return json(
		{
			success: true,
			group_id: groupId,
			instance_ids: instanceIds,
			message: `Created gathering "${name}" with ${instanceIds.length} instance(s)`
		},
		{ status: 201 }
	);
};
