// src/app.d.ts
// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Role } from '$lib/auth/roles';
import type { churches, people } from '$lib/server/db/schema';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			// ------------------------------------------------------------
			// Request Tracking
			// ------------------------------------------------------------
			/** Short request ID for log correlation (set in hooks.server.ts) */
			rid: string;

			// ------------------------------------------------------------
			// Supabase Auth & Client
			// ------------------------------------------------------------
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{
				session: Session | null;
				user: User | null;
			}>;

			// ------------------------------------------------------------
			// Tenant Context (nullable for invalid subdomains / public pages)
			// ------------------------------------------------------------
			church: typeof churches.$inferSelect | null;

			// ------------------------------------------------------------
			// ACTOR — authenticated human (WHO AM I)
			// ------------------------------------------------------------
			// - Derived from auth.user → people.user_id
			// - MUST NOT depend on route params
			// - Stable for the entire request lifecycle
			actor: (typeof people.$inferSelect & { role: Role }) | null;

			// ------------------------------------------------------------
			// LEGACY / TRANSITIONAL (optional)
			// ------------------------------------------------------------
			// ⚠️ DO NOT use for auth or permissions.
			// ⚠️ May be removed once all routes are migrated.
			// Prefer:
			//   - locals.actor (who is logged in)
			//   - page.data.person (who is being viewed)
			person?: (typeof people.$inferSelect & { role: Role }) | null;
		}

		interface PageData {
			session: Session | null;
			church?: typeof churches.$inferSelect | null;
			actor?: (typeof people.$inferSelect & { role: Role }) | null;
		}

		interface Error {
			message: string;
			rid?: string;
			status?: number;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

// ------------------------------------------------------------
// External icon support (unplugin-icons, etc.)
// ------------------------------------------------------------
declare module '~icons/*' {
	import type { Component } from 'svelte';
	const component: Component;
	export default component;
}

export {};
