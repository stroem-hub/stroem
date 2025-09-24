import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		tailwindcss()
	],
	server: {
		proxy: {
			'/api': 'http://localhost:8080', // Proxy API to Rust backend during dev
			'/auth': 'http://localhost:8080',
		}
	}
});
