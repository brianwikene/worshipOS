// ui/src/hooks.server.ts
// Server hooks for request processing

import { error, type Handle } from '@sveltejs/kit';
import { getChurchId } from '$lib/server/tenant';

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Enforce tenant for API routes
	if (pathname.startsWith('/api')) {
		const churchId = getChurchId(event);

		if (!churchId) {
			throw error(400, 'church_id is required');
		}

		event.locals.churchId = churchId;
	}

	return resolve(event);
};
