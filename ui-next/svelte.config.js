import adapter from '@sveltejs/adapter-vercel'; // Or adapter-auto / adapter-node based on your deploy target
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			// "Clean Architecture" aliases to avoid ../../../ hell
			$components: 'src/lib/components',
			$db: 'src/lib/server/db',
			$types: 'src/lib/types'
		}
	},

	// Svelte 5 Specifics
	compilerOptions: {
		// Enforce modern syntax (optional, but good for "clean build" discipline)
		runes: true
		//Make a11y warnings strict locally so you catch them before CI
	}
};

export default config;
