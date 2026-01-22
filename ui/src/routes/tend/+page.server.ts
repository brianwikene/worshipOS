// /ui/src/routes/tend/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Please sign in.');

	return { user };
};
