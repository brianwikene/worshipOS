// /ui/vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const isTest = process.env.VITEST === 'true';
const projectDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: isTest ? [] : [sveltekit()],
	resolve: {
		alias: {
			$lib: pathResolve(projectDir, 'src/lib')
		}
	},
	server: {
		host: '127.0.0.1',
		strictPort: true,
		cors: false
	},
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
