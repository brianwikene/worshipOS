import { db } from '$lib/server/db';
import { campuses, churches, people } from '$lib/server/db/schema';
import { error, fail, type Actions } from '@sveltejs/kit';
import { and, eq, inArray, isNull, not } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// 1. Fetch Campuses (Active only)
	const churchCampuses = await db.query.campuses.findMany({
		where: and(eq(campuses.church_id, church.id), isNull(campuses.deleted_at)),
		orderBy: (c, { asc }) => [asc(c.name)]
	});

	// 2. Fetch Staff (Admins & Pastors)
	const staffMembers = await db.query.people.findMany({
		where: and(
			eq(people.church_id, church.id),
			inArray(people.role, ['admin', 'pastor']),
			isNull(people.deleted_at)
		),
		orderBy: (p, { asc }) => [asc(p.last_name)]
	});

	// 3. Fetch Non-Staff for the "Add Staff" dropdown
	const potentialStaff = await db.query.people.findMany({
		where: and(
			eq(people.church_id, church.id),
			not(inArray(people.role, ['admin', 'pastor'])),
			isNull(people.deleted_at)
		),
		orderBy: (p, { asc }) => [asc(p.first_name)]
	});

	return {
		churchData: church,
		campuses: churchCampuses,
		staff: staffMembers,
		potentialStaff
	};
};

export const actions = {
	updateChurch: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401);
		const data = await request.formData();
		const name = data.get('name') as string;

		if (!name) return fail(400, { error: 'Name is required' });

		await db.update(churches).set({ name }).where(eq(churches.id, church.id));
		return { success: true };
	},

	createCampus: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401);
		const data = await request.formData();
		const name = data.get('name') as string;
		const location = data.get('location') as string;

		if (!name) return fail(400, { error: 'Campus Name is required' });

		await db.insert(campuses).values({
			church_id: church.id,
			name,
			location
		});
		return { success: true };
	},

	deleteCampus: async ({ request, locals }) => {
		// FIX: Use 'locals' to enforce tenancy (Security)
		const { church } = locals;
		if (!church) return fail(401);

		const data = await request.formData();
		const id = data.get('id') as string;

		await db
			.update(campuses)
			.set({ deleted_at: new Date() })
			.where(
				and(
					eq(campuses.id, id),
					eq(campuses.church_id, church.id) // Scope to current church
				)
			);
		return { success: true };
	},

	promoteStaff: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401);

		const data = await request.formData();
		const personId = data.get('person_id') as string;
		const role = data.get('role') as string; // 'admin' or 'pastor'

		await db
			.update(people)
			.set({ role })
			.where(and(eq(people.id, personId), eq(people.church_id, church.id)));

		return { success: true };
	},

	demoteStaff: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401);

		const data = await request.formData();
		const personId = data.get('person_id') as string;

		// Reset to default 'user'
		await db
			.update(people)
			.set({ role: 'user' })
			.where(and(eq(people.id, personId), eq(people.church_id, church.id)));

		return { success: true };
	}
} satisfies Actions;
