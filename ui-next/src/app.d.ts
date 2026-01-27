// See https://svelte.dev/docs/kit/types#app.d.ts
import type { churches } from '$lib/server/db/schema';

declare global {
	namespace App {
		// interface Error {}

		interface Locals {
			// The property must be INSIDE these curly braces
			church: typeof churches.$inferSelect;
		}

		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Ensure external icon libraries work (if you use unplugin-icons)
declare module '~icons/*' {
	import type { SvelteComponent } from 'svelte';
	const component: typeof SvelteComponent;
	export default component;
}

export {};
