// src/lib/server/diag.ts
// Diagnostic utilities for debugging and logging

import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Check if debug logging is enabled for this request.
 * Enabled when:
 * - SERVER_LOG=1 env var is set (global)
 * - ?debug=1 or ?serverlog=1 query param (per-request)
 */
export function isDebugEnabled(event: RequestEvent): boolean {
	return (
		env.SERVER_LOG === '1' ||
		event.url.searchParams.get('debug') === '1' ||
		event.url.searchParams.get('serverlog') === '1'
	);
}

/**
 * Extract safe diagnostic context from a request event.
 * This extracts IDs without dumping full locals objects.
 */
export function getDiagContext(event: RequestEvent) {
	const locals = event.locals;

	return {
		rid: locals.rid ?? 'no-rid',
		churchId: locals.church?.id ?? 'none',
		churchName: locals.church?.name ?? 'none',
		actorId: locals.actor?.id ?? 'anon',
		actorName: locals.actor ? `${locals.actor.first_name} ${locals.actor.last_name}` : 'anonymous',
		path: event.url.pathname,
		method: event.request.method,
		params: event.params
	};
}
