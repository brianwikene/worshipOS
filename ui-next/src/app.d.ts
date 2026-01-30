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
	import type { Component } from 'svelte';
	const component: Component;
	export default component;
}

export {};
