import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Check session
	const { session } = await locals.safeGetSession();

	// If logged in -> Dashboard
	if (session) {
		throw redirect(303, '/dashboard');
	}

	// If NOT logged in -> Login
	throw redirect(303, '/login');
};
