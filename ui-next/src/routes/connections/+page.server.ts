import { db } from '$lib/server/db';
import { people } from '$lib/server/db/schema'; // <--- ADD THIS IMPORT
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// Fetch all people for this tenant
	const people = await db.query.people.findMany({
		where: (people, { eq }) => eq(people.church_id, church.id),
		with: {
			family: true,
			teamMemberships: {
				with: {
					team: true
				}
			}
		},
		orderBy: (people, { asc }) => [asc(people.last_name), asc(people.first_name)]
	});

	return { people };
};
export const actions = {
	create: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const firstName = formData.get('first_name') as string;
		const lastName = formData.get('last_name') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;

		if (!firstName || !lastName) {
			return fail(400, { error: 'Name is required' });
		}

		try {
			await db.insert(people).values({
				church_id: church.id, // <--- Automatic Tenancy!
				first_name: firstName,
				last_name: lastName,
				email: email || null, // convert empty string to null
				phone: phone || null
			});

			return { success: true };
		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Failed to create person' });
		}
	}
} satisfies Actions;
