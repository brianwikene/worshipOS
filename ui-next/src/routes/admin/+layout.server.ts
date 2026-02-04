import { requireAdmin } from '$lib/auth/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Require admin:access permission to view any admin page
	// This will redirect to /login if not authenticated,
	// or throw 403 if authenticated but lacking permission
	requireAdmin({ locals, url });

	// If we get here, user has admin access
	return {};
};
