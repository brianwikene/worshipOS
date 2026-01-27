// src/routes/gatherings/[gathering_id]/instances/[instance_id]/+layout.server.ts
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const churchId = locals.church?.id;
	if (!churchId) throw error(400, 'Active church is required');

	const { gathering_id, instance_id } = params;

	if (!gathering_id || !instance_id) {
		throw error(400, 'Missing route parameters');
	}

	// Fetch the gathering (tenant-scoped)
	const gathering = await db.query.gatherings.findFirst({
		where: (g, { and, eq }) => and(eq(g.id, gathering_id), eq(g.church_id, churchId)),
		with: {
			campus: true
		}
	});

	if (!gathering) {
		throw error(404, 'Gathering not found');
	}

	// Fetch the instance (tenant + gathering scoped)
	const instance = await db.query.instances.findFirst({
		where: (i, { and, eq }) => and(eq(i.id, instance_id), eq(i.gathering_id, gathering_id))
	});

	if (!instance) {
		throw error(404, 'Instance not found');
	}

	return {
		gathering,
		instance
	};
};
