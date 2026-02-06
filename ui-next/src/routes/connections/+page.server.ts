import { db } from '$lib/server/db';
import { people } from '$lib/server/db/schema';
import type { Actions } from '@sveltejs/kit'; // <--- Import from kit
import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types'; // <--- Keep this for route types

export const load: PageServerLoad = async ({ locals }) => {
	// --- THE GUARD CLAUSE ---
	if (!locals.church) {
		throw error(404, 'Church not found');
	}
	const { church } = locals; // TypeScript now knows 'church' is safe!

	// 1. Fetch the data
	const connectionsList = await db.query.people.findMany({
		where: eq(people.church_id, church.id),
		with: {
			family: {
				with: { addresses: true }
			},
			teamMemberships: {
				with: { team: true }
			},
			personalAddresses: true
		},
		orderBy: [asc(people.last_name), asc(people.first_name)]
	});

	// 2. Return it as 'connections' (Matches your +page.svelte)
	return { connections: connectionsList };
};

export const actions = {
	create: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401, { error: 'Unauthorized' });

		const data = await request.formData();
		const firstName = data.get('first_name') as string;
		const lastName = data.get('last_name') as string;
		const email = data.get('email') as string;
		const phone = data.get('phone') as string;

		const errors: Record<string, string> = {};

		if (!firstName || firstName.length < 2) {
			errors.first_name = 'First name is required (min 2 chars)';
		}
		if (!lastName || lastName.length < 2) {
			errors.last_name = 'Last name is required (min 2 chars)';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				error: true,
				errors,
				values: { first_name: firstName, last_name: lastName, email, phone }
			});
		}

		try {
			await db.insert(people).values({
				church_id: church.id,
				first_name: firstName,
				last_name: lastName,
				email: email || null,
				phone: phone || null
			});

			return { success: true };
		} catch (err) {
			console.error(err);
			return fail(500, { error: true, message: 'Database error. Please try again.' });
		}
	}
} satisfies Actions;
