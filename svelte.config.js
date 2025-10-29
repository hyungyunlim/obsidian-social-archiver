import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Enable Svelte 5 Runes mode
    runes: true,
    // Enable HMR (Svelte 5 integrated)
    hmr: true,
    // CSS handling
    css: 'injected'
  }
};