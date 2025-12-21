// ui/src/lib/server/tenant.ts
// Tenant extraction utilities for SvelteKit server-side operations

import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';

/**
 * Extract the church ID from the request.
 * - Primary: X-Church-Id header
 * - Dev fallback: ?church_id query parameter
 *
 * @returns The church ID or null if not provided
 */
export function getChurchId(event: RequestEvent): string | null {
	// Primary: header
	const headerId = event.request.headers.get('x-church-id');
	if (headerId) {
		return headerId;
	}

	// Dev fallback: query parameter
	if (dev) {
		const queryId = event.url.searchParams.get('church_id');
		if (queryId) {
			return queryId;
		}
	}

	return null;
}

/**
 * Extract the church ID, throwing if not present.
 * Use this when the church ID is required.
 */
export function requireChurchId(event: RequestEvent): string {
	const churchId = getChurchId(event);
	if (!churchId) {
		throw new Error('church_id is required');
	}
	return churchId;
}
