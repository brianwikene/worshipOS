import { createServerClient } from '@supabase/ssr';
import { type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { db } from '$lib/server/db';
import { churches, people } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Role } from '$lib/auth/roles';

export const handle: Handle = async ({ event, resolve }) => {
	/**
	 * ------------------------------------------------------------------
	 * 1. Initialize Supabase (Authentication Layer)
	 * ------------------------------------------------------------------
	 */
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	/**
	 * 2. Safe Session Retrieval
	 * This creates a helper to safely get the user/session during load functions.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	/**
	 * ------------------------------------------------------------------
	 * 3. Tenant Resolution (Existing Subdomain Logic)
	 * ------------------------------------------------------------------
	 */
	const host = event.request.headers.get('host') || '';
	let church = null;
	let subdomain = '';

	// Parse Subdomain
	if (host.includes('localhost')) {
		const parts = host.split('.');
		if (parts.length > 1) subdomain = parts[0];
	} else {
		const parts = host.split('.');
		if (parts.length > 2) subdomain = parts[0];
	}

	// Lookup Church by Subdomain
	if (subdomain) {
		church = await db.query.churches.findFirst({
			where: eq(churches.subdomain, subdomain)
		});
	}

	// Dev Fallback
	if (!church && host.includes('localhost') && !subdomain) {
		church = await db.query.churches.findFirst();
	}

	// Attach to Locals
	event.locals.church = church || null;

	/**
	 * ------------------------------------------------------------------
	 * 4. Person Resolution (Link Supabase User to Person record)
	 * ------------------------------------------------------------------
	 */
	event.locals.person = null;

	if (church) {
		const { user } = await event.locals.safeGetSession();

		if (user) {
			// Find the person record linked to this Supabase user
			const person = await db.query.people.findFirst({
				where: and(eq(people.church_id, church.id), eq(people.user_id, user.id))
			});

			if (person) {
				event.locals.person = {
					...person,
					role: (person.role as Role) || 'member'
				};
			}
		}
	}

	/**
	 * ------------------------------------------------------------------
	 * 5. Resolve Request
	 * ------------------------------------------------------------------
	 */
	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			// Required for Supabase to handle large list ranges
			return name === 'content-range';
		}
	});
};
