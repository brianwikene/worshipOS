import { db } from '$lib/server/db';
import { churches } from '$lib/server/db/schema';
import type { Handle } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host') || '';
	let church;

	// 1. Production / Subdomain Logic
	// e.g. "mountain.worshipos.app" -> subdomain = "mountain"
	const subdomain = host.split('.')[0];

	if (subdomain && subdomain !== 'localhost') {
		church = await db.query.churches.findFirst({
			where: eq(churches.subdomain, subdomain)
		});
	}

	// 2. Dev Mode Fallback (Just grab the first one)
	if (!church && host.includes('localhost')) {
		church = await db.query.churches.findFirst();
	}

	// 3. Attach to Locals
	if (church) {
		event.locals.church = church;
	} else {
		// If no church found, we might want to redirect to a "Register" page later
		// For now, we'll let it slide, but queries might fail.
	}

	return resolve(event);
};
