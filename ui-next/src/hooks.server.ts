import { db } from '$lib/server/db';
import { churches } from '$lib/server/db/schema';
import type { Handle } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host') || '';
	let church;
	let subdomain = '';

	// 1. Parse Subdomain (Handles both Localhost and Production)
	if (host.includes('localhost')) {
		// Scenario A: Localhost
		// "mountain.localhost:5174" -> parts = ["mountain", "localhost:5174"]
		// "localhost:5174"          -> parts = ["localhost:5174"]
		const parts = host.split('.');
		if (parts.length > 1) {
			subdomain = parts[0];
		}
	} else {
		// Scenario B: Production (e.g. Vercel / Railway)
		// "mountain.worshipos.app" -> parts = ["mountain", "worshipos", "app"]
		const parts = host.split('.');
		if (parts.length > 2) {
			subdomain = parts[0];
		}
	}

	// 2. Try to find Church by Subdomain
	if (subdomain) {
		church = await db.query.churches.findFirst({
			where: eq(churches.subdomain, subdomain)
		});
	}

	// 3. Dev Fallback: If no subdomain is present, grab the first one found.
	// This prevents the app from breaking if you just visit "http://localhost:5174"
	if (!church && host.includes('localhost') && !subdomain) {
		church = await db.query.churches.findFirst();
	}

	// 4. Attach to Locals
	if (church) {
		event.locals.church = church;
	} else {
		// Optional: Redirect to a 404 or "Create Church" page if subdomain is invalid
		// console.log('No church found for host:', host);
	}

	return resolve(event);
};
