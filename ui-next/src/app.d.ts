// src/app.d.ts
// See https://svelte.dev/docs/kit/types#app.d.ts
import type { churches, people } from '$lib/server/db/schema';
import type { Role } from '$lib/auth/roles';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}

		interface Locals {
			// Supabase Auth & Client
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;

			// Tenant Context (Nullable because a user might visit an invalid subdomain)
			church: typeof churches.$inferSelect | null;

			// Current Person (linked to Supabase user, null if not logged in)
			person: (typeof people.$inferSelect & { role: Role }) | null;
		}

		interface PageData {
			session: Session | null;
		}

		// interface PageState {}
		// interface Platform {}
	}
}

// Ensure external icon libraries work (if you use unplugin-icons)
declare module '~icons/*' {
	import type { Component } from 'svelte';
	const component: Component;
	export default component;
}

export {};
