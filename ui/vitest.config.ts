import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: [
			// Temporarily exclude component tests that use mount() until Svelte 5 testing is properly configured
			'src/lib/components/**/*.test.ts',
			'node_modules/**'
		],
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
		globals: true,
		// Configure for Svelte 5 compatibility
		alias: {
			'svelte': 'svelte'
		}
	},
	// Ensure proper handling of Svelte components in tests
	define: {
		'import.meta.vitest': 'undefined'
	}
});