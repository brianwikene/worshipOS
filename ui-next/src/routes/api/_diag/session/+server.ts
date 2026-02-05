// src/routes/api/_diag/session/+server.ts
// Returns current session state for debugging auth issues

import { logRequest } from '$lib/server/log';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	logRequest(event, 'diag.session');

	const { session, user } = await event.locals.safeGetSession();

	return json({
		hasSession: !!session,
		userId: user?.id ?? null,
		email: user?.email ?? null,
		// Include actor info if available
		actorId: event.locals.actor?.id ?? null,
		actorName: event.locals.actor
			? `${event.locals.actor.first_name} ${event.locals.actor.last_name}`
			: null,
		actorRole: event.locals.actor?.role ?? null
	});
};
