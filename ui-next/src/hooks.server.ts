import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Role } from '$lib/auth/roles';
import { db } from '$lib/server/db';
import { churches, people } from '$lib/server/db/schema';
import { isDebugEnabled } from '$lib/server/diag';
import { logRequest, logServerError } from '$lib/server/log';
import { createServerClient } from '@supabase/ssr';
import { type Handle, type HandleServerError } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
	/**
	 * ------------------------------------------------------------------
	 * 0. Request ID for correlation (UI <-> terminal <-> stored errors)
	 * ------------------------------------------------------------------
	 */
	const rid = randomUUID().slice(0, 8);
	event.locals.rid = rid;

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
	 * ------------------------------------------------------------------
	 * 2. Safe Session Retrieval
	 * ------------------------------------------------------------------
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) return { session: null, user: null };

		return { session, user };
	};
	const { session, user } = await event.locals.safeGetSession();

	// Debug logging (controlled by SERVER_LOG env or ?debug=1 query param)
	if (isDebugEnabled(event)) {
		logRequest(event, 'incoming', {
			hasSession: !!session,
			userId: user?.id,
			email: user?.email
		});
	}

	/**
	 * ------------------------------------------------------------------
	 * 3. Tenant Resolution (Subdomain → Church)
	 * ------------------------------------------------------------------
	 */
	const host = event.request.headers.get('host') || '';
	let church = null;
	let subdomain = '';

	if (host.includes('localhost')) {
		const parts = host.split('.');
		if (parts.length > 1) subdomain = parts[0];
	} else {
		const parts = host.split('.');
		if (parts.length > 2) subdomain = parts[0];
	}

	if (subdomain) {
		church = await db.query.churches.findFirst({
			where: eq(churches.subdomain, subdomain)
		});
	}

	// Dev fallback (single-tenant localhost)
	if (!church && host.includes('localhost') && !subdomain) {
		church = await db.query.churches.findFirst();
	}

	event.locals.church = church ?? null;

	/**
	 * ------------------------------------------------------------------
	 * 4. Authenticated Actor Resolution (WHO AM I)
	 * ------------------------------------------------------------------
	 * This must NEVER be overwritten by route/page data.
	 */
	event.locals.actor = null;

	if (church) {
		const { user } = await event.locals.safeGetSession();

		if (user) {
			const actor = await db.query.people.findFirst({
				where: and(eq(people.church_id, church.id), eq(people.user_id, user.id))
			});

			if (actor) {
				event.locals.actor = {
					...actor,
					role: (actor.role as Role) || 'member'
				};
			}
		}
	}

	/**
	 * IMPORTANT:
	 * - We intentionally DO NOT set `event.locals.person`
	 * - Page routes must load their own subject entities
	 */

	/**
	 * ------------------------------------------------------------------
	 * 5. Resolve Request
	 * ------------------------------------------------------------------
	 */
	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-request-id';
		}
	});

	// Attach request ID to response for client-side correlation
	response.headers.set('x-request-id', rid);
	return response;
};

/**
 * Global error handler - captures all server errors with full context.
 * Errors are ALWAYS logged (not gated by debug flag) because they're high-signal.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	// Always log server errors with full context
	logServerError(event, status, error, { message });

	// What the client gets - minimal but includes rid for correlation
	return {
		message,
		rid: event.locals.rid ?? 'no-rid',
		status
	};
};
