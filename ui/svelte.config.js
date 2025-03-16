import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: '../server/static',
			assets: '../server/static',
			fallback: 'index.html',
			precompress: false
		}),
		paths: {
			base: ''
		}
	}
};