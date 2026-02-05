// src/routes/api/_diag/whoami/+server.ts
// Returns current auth/tenant context for debugging

import { getDiagContext } from '$lib/server/diag';
import { logRequest } from '$lib/server/log';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	logRequest(event, 'diag.whoami');

	const ctx = getDiagContext(event);

	return json({
		ok: true,
		...ctx,
		// Additional context useful for debugging
		hasSupabase: !!event.locals.supabase,
		url: event.url.toString()
	});
};
