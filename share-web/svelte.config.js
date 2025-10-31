import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-cloudflare for Cloudflare Pages deployment
		adapter: adapter(),
		alias: {
			$lib: './src/lib',
			$components: './src/lib/components'
		}
	},

	compilerOptions: {
		// Svelte 5 runes mode
		runes: true
	}
};

export default config;
